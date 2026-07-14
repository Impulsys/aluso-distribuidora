"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { getAllOrders } from "@/lib/orders";
import {
  updateOrderStatus,
  subscribeProductCosts,
  setProductOverride,
} from "@/lib/admin";
import {
  crearRemitoDesdePedido,
  crearRemitoDirecto,
  subscribeRemitos,
  subscribeFacturas,
  mensajeVentaError,
} from "@/lib/ventas";
import { useProducts } from "@/hooks/useProducts";
import { remitoHTML } from "@/lib/remito-print";
import { printFactura } from "@/lib/factura-print";
import { emitirFacturaAfip, mensajeFacturaError } from "@/lib/factura-afip";
import CajaView from "@/components/CajaView";
import RegistroHistorico from "@/components/RegistroHistorico";
import { useAuth } from "@/context/AuthContext";
import { formatARS, formatDate } from "@/lib/format";
import { coincide } from "@/lib/search";
import type {
  Factura,
  FormaPago,
  Order,
  OrderStatus,
  Remito,
  RemitoItem,
  TipoFactura,
} from "@/lib/types";

const FORMAS_PAGO: { id: FormaPago; label: string }[] = [
  { id: "efectivo", label: "💵 Efectivo" },
  { id: "transferencia", label: "🏦 Transferencia" },
];

const STATUS_OPTIONS: OrderStatus[] = [
  "nuevo",
  "en_proceso",
  "entregado",
  "cancelado",
];
const STATUS_STYLES: Record<OrderStatus, string> = {
  nuevo: "bg-sky-100 text-sky-800 ring-sky-300",
  en_proceso: "bg-amber-100 text-amber-800 ring-amber-300",
  entregado: "bg-emerald-100 text-emerald-800 ring-emerald-300",
  cancelado: "bg-rose-100 text-rose-800 ring-rose-300",
};
const STATUS_LABEL: Record<OrderStatus, string> = {
  nuevo: "Nuevo",
  en_proceso: "En proceso",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

type SubTab = "nueva" | "pedidos" | "caja" | "historico" | "facturar";

export default function AdminVentasPage() {
  const [tab, setTab] = useState<SubTab>("nueva");

  return (
    <div>
      {/* Sub-navegación */}
      <nav className="mb-5 inline-flex flex-wrap gap-1 rounded-xl bg-surface p-1 ring-1 ring-brand-border">
        {(
          [
            { id: "nueva", label: "🛒 Nueva venta" },
            { id: "pedidos", label: "📋 Pedidos" },
            { id: "caja", label: "💵 Caja" },
            { id: "historico", label: "📚 Registro histórico" },
            { id: "facturar", label: "🧾 Facturar" },
          ] as { id: SubTab; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "bg-primary text-white shadow-sm"
                : "text-brand-dark hover:bg-primary-light"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "nueva" && <NuevaVentaView />}
      {tab === "pedidos" && <PedidosView />}
      {tab === "caja" && <CajaView />}
      {tab === "historico" && <RegistroHistorico />}
      {tab === "facturar" && <FacturarView />}
    </div>
  );
}

// ==================== NUEVA VENTA (Punto de venta) ====================
interface POSLine extends RemitoItem {
  stock: number;
  precioLista: number; // precio actual en la lista (para detectar cambios)
  imagen?: string;
}

function NuevaVentaView() {
  const { user } = useAuth();
  const productos = useProducts();
  const [costs, setCosts] = useState<Record<string, number>>({});
  const [cliente, setCliente] = useState("");
  const [formaPago, setFormaPago] = useState<FormaPago>("efectivo");
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<POSLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeProductCosts(setCosts), []);

  const resultados = useMemo(() => {
    const t = q.trim();
    if (!t) return [];
    return productos
      .filter(
        (p) => p.activo && (coincide(p.nombre, t) || (p.ean ?? "").includes(t))
      )
      .slice(0, 8);
  }, [productos, q]);

  const add = (id: string) => {
    const p = productos.find((x) => x.id === id);
    if (!p) return;
    if (lines.some((l) => l.productId === id)) {
      setLines((prev) =>
        prev.map((l) =>
          l.productId === id ? { ...l, cantidad: l.cantidad + 1 } : l
        )
      );
    } else {
      setLines((prev) => [
        ...prev,
        {
          productId: p.id,
          codigo: p.codigo,
          nombre: p.nombre,
          cantidad: 1,
          precioVenta: p.precioVenta,
          costoUnitario: costs[p.id] ?? 0,
          stock: p.stock,
          precioLista: p.precioVenta,
          imagen: p.imagen,
        },
      ]);
    }
    setQ("");
  };

  const upd = (id: string, patch: Partial<POSLine>) =>
    setLines((prev) =>
      prev.map((l) => (l.productId === id ? { ...l, ...patch } : l))
    );
  const del = (id: string) =>
    setLines((prev) => prev.filter((l) => l.productId !== id));

  const guardarPrecioLista = async (l: POSLine) => {
    try {
      await setProductOverride(l.productId, { precioVenta: l.precioVenta });
      upd(l.productId, { precioLista: l.precioVenta });
      setMsg(`Precio de "${l.nombre}" actualizado en la lista.`);
    } catch {
      setError("No se pudo guardar el precio en la lista.");
    }
  };

  const total = lines.reduce((s, l) => s + l.precioVenta * l.cantidad, 0);
  const totalItems = lines.reduce((s, l) => s + l.cantidad, 0);

  const generar = async () => {
    setError(null);
    setMsg(null);
    // Sanitizar cantidades/precios (evita NaN o 0 que contaminan totales)
    const items: RemitoItem[] = lines.map((l) => ({
      productId: l.productId,
      codigo: l.codigo,
      nombre: l.nombre,
      cantidad: Math.max(1, Math.floor(Number(l.cantidad) || 0)),
      precioVenta: Math.max(0, Number(l.precioVenta) || 0),
      costoUnitario: l.costoUnitario,
    }));
    const totalCalc = items.reduce((s, it) => s + it.precioVenta * it.cantidad, 0);
    if (items.length === 0 || totalCalc <= 0) {
      setError("Agregá al menos un producto con cantidad y precio válidos.");
      return;
    }
    setBusy(true);
    // Abrimos la ventana YA (en el gesto del click) para que no la bloquee el
    // navegador; la rellenamos cuando el remito esté creado.
    const printWin = window.open("", "_blank", "width=820,height=900");
    try {
      const r = await crearRemitoDirecto({
        items,
        clienteNombre: cliente.trim() || undefined,
        formaPago,
        createdBy: user?.uid,
      });
      if (printWin) {
        printWin.document.write(remitoHTML(r));
        printWin.document.close();
        printWin.focus();
      }
      setMsg(`Remito ${r.numero} generado. Stock descontado.`);
      setLines([]);
      setCliente("");
      setFormaPago("efectivo");
    } catch (e) {
      console.error(e);
      if (printWin) printWin.close();
      setError(mensajeVentaError(e));
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      {/* ----- Buscador + carrito ----- */}
      <div className="rounded-2xl border border-brand-border bg-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-serif text-lg text-brand-dark">
            🛒 Punto de venta
          </h2>
          <span className="ml-auto text-xs text-brand-dark/55">
            Carrito · {totalItems} u. · {lines.length} ítem
            {lines.length === 1 ? "" : "s"}
          </span>
        </div>

        {/* Buscador con desplegable de resultados */}
        <div className="relative">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="🔎 Escaneá o buscá producto por nombre o código…"
            className={`${inputCls} text-base`}
          />
          {q.trim() !== "" && (
            <div className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-brand-border bg-white shadow-xl">
              {resultados.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-brand-dark/45">
                  Sin resultados para “{q}”.
                </p>
              ) : (
                resultados.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => add(p.id)}
                    className="flex w-full items-center gap-3 border-b border-brand-border/60 px-3 py-2 text-left transition last:border-b-0 hover:bg-primary-light/40"
                  >
                    <span className="relative h-40 w-40 shrink-0 overflow-hidden rounded-lg border border-brand-border bg-white">
                      <Image
                        src={p.imagen}
                        alt={p.nombre}
                        fill
                        sizes="160px"
                        className="object-contain p-1"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-brand-dark">
                        {p.nombre}
                      </span>
                      <span className="text-xs text-brand-dark/50">
                        Stock {p.stock} ·{" "}
                        {p.precioVenta > 0
                          ? formatARS(p.precioVenta)
                          : "sin precio"}
                      </span>
                    </span>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-base font-bold text-white">
                      ＋
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Carrito */}
        <div className="mt-3 divide-y divide-brand-border rounded-lg border border-brand-border">
          {lines.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-brand-dark/40">
              Agregá productos desde el buscador para armar el remito.
            </p>
          ) : (
            lines.map((l) => {
              const cambio =
                l.precioVenta > 0 && l.precioVenta !== l.precioLista;
              return (
                <div key={l.productId} className="px-5 py-3">
                  <div className="flex items-start gap-3">
                    <span className="relative h-40 w-40 shrink-0 overflow-hidden rounded-lg border border-brand-border bg-white">
                      <Image
                        src={l.imagen || "https://placehold.co/600x600/006081/ffffff?text=Producto"}
                        alt={l.nombre}
                        fill
                        sizes="160px"
                        className="object-contain p-1"
                      />
                    </span>
                    <p className="min-w-0 flex-1 text-sm font-medium text-brand-dark">
                      {l.nombre}
                      {l.cantidad > l.stock && (
                        <span className="ml-1 text-[10px] font-bold text-rose-600">
                          ⚠ stock {l.stock}
                        </span>
                      )}
                    </p>
                    <button
                      onClick={() => del(l.productId)}
                      className="shrink-0 text-brand-dark/40 hover:text-rose-600"
                      title="Quitar"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex items-center overflow-hidden rounded-lg border border-brand-border">
                      <button
                        onClick={() =>
                          upd(l.productId, {
                            cantidad: Math.max(1, l.cantidad - 1),
                          })
                        }
                        className="grid h-8 w-8 place-items-center text-lg hover:bg-primary-light"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={l.cantidad || ""}
                        onChange={(e) =>
                          upd(l.productId, { cantidad: Number(e.target.value) })
                        }
                        className="h-8 w-12 border-x border-brand-border text-center text-sm outline-none"
                      />
                      <button
                        onClick={() =>
                          upd(l.productId, { cantidad: l.cantidad + 1 })
                        }
                        className="grid h-8 w-8 place-items-center text-lg hover:bg-primary-light"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-xs text-brand-dark/45">$</span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={l.precioVenta || ""}
                        onChange={(e) =>
                          upd(l.productId, {
                            precioVenta: Number(e.target.value),
                          })
                        }
                        placeholder="precio"
                        className="h-8 w-24 rounded-lg border border-brand-border px-2 text-right text-sm outline-none focus:border-primary"
                      />
                    </div>

                    <span className="ml-auto w-24 text-right text-sm font-bold text-primary">
                      {formatARS(l.precioVenta * l.cantidad)}
                    </span>
                  </div>

                  {cambio && (
                    <button
                      onClick={() => guardarPrecioLista(l)}
                      className="mt-1 text-[11px] font-medium text-primary hover:underline"
                    >
                      💾 Guardar {formatARS(l.precioVenta)} en la lista
                      {l.precioLista > 0
                        ? ` (lista: ${formatARS(l.precioLista)})`
                        : ""}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ----- Panel de venta (lateral) ----- */}
      <div className="flex h-fit flex-col gap-3 lg:sticky lg:top-4">
        <div className="rounded-2xl border-2 border-primary/20 bg-surface p-4 shadow-sm">
          <div className="flex items-baseline justify-between border-b border-brand-border pb-2">
            <span className="text-sm text-brand-dark/60">Subtotal</span>
            <span className="text-sm font-medium">{formatARS(total)}</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-serif text-lg text-brand-dark">TOTAL</span>
            <span className="font-serif text-3xl font-bold text-primary">
              {formatARS(total)}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-brand-border bg-surface p-4">
          <label className="mb-1 block text-[11px] font-bold uppercase text-brand-dark/55">
            Cliente (opcional)
          </label>
          <input
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            placeholder="Nombre del cliente"
            className={inputCls}
          />

          <label className="mb-1 mt-3 block text-[11px] font-bold uppercase text-brand-dark/55">
            Forma de pago
          </label>
          <div className="grid grid-cols-3 gap-1">
            {FORMAS_PAGO.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormaPago(f.id)}
                className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                  formaPago === f.id
                    ? "border-primary bg-primary text-white"
                    : "border-brand-border bg-white text-brand-dark/70 hover:border-primary"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {error && (
            <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900">
              {error}
            </p>
          )}
          {msg && (
            <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              ✓ {msg}
            </p>
          )}

          <button
            onClick={generar}
            disabled={busy || lines.length === 0}
            className="mt-3 w-full rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-60"
          >
            {busy ? "Generando…" : "🚚 Generar remito"}
          </button>
          {lines.length > 0 && (
            <button
              onClick={() => {
                setLines([]);
                setCliente("");
              }}
              className="mt-2 w-full rounded-lg border border-brand-border px-4 py-2 text-sm font-medium hover:bg-rose-50 hover:text-rose-700"
            >
              Limpiar venta
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== PEDIDOS ====================
function PedidosView() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [costs, setCosts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<"todos" | OrderStatus>("todos");
  const [origen, setOrigen] = useState<"todos" | "web" | "vendedor">("todos");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setOrders(await getAllOrders(200));
      setError(null);
    } catch (e) {
      console.error(e);
      setError("No se pudieron cargar los pedidos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const unsub = subscribeProductCosts(setCosts);
    return unsub;
  }, []);

  const visible = useMemo(() => {
    const t = q.trim();
    return orders
      .filter((o) => (filter === "todos" ? true : o.status === filter))
      .filter((o) => (origen === "todos" ? true : o.origin === origen))
      .filter((o) => {
        if (!t) return true;
        return (
          coincide(o.id, t) ||
          coincide(o.clienteNombre ?? "", t) ||
          coincide(o.clienteTelefono ?? "", t) ||
          coincide(o.createdByName ?? "", t) ||
          o.items.some((i) => coincide(i.nombre, t))
        );
      });
  }, [orders, filter, origen, q]);

  const handleStatus = async (id: string, status: OrderStatus) => {
    setBusy(id);
    try {
      await updateOrderStatus(id, status);
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    } catch (e) {
      console.error(e);
      alert("No se pudo actualizar el pedido.");
    } finally {
      setBusy(null);
    }
  };

  const handleRemito = async (o: Order) => {
    if (o.remitoId) {
      alert("Este pedido ya tiene un remito generado.");
      return;
    }
    if (
      !confirm(
        `¿Generar remito del pedido de ${o.clienteNombre || "cliente"}? Esto descuenta el stock de los productos.`
      )
    )
      return;
    setBusy(o.id);
    try {
      const r = await crearRemitoDesdePedido(o, costs, user?.uid);
      alert(`Remito ${r.numero} generado. Stock descontado.`);
      setOrders((prev) =>
        prev.map((x) =>
          x.id === o.id ? { ...x, status: "entregado", remitoId: r.id } : x
        )
      );
    } catch (e) {
      console.error(e);
      alert(mensajeVentaError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por cliente, vendedor, producto o nº…"
          className="w-full rounded-full border border-brand-border bg-surface px-4 py-2 text-sm outline-none focus:border-primary sm:flex-1"
        />
        <div className="inline-flex overflow-hidden rounded-full border border-brand-border bg-surface text-xs">
          {(
            [
              { id: "todos", label: "Todos" },
              { id: "vendedor", label: "👤 Vendedor" },
              { id: "web", label: "🌐 Web" },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              onClick={() => setOrigen(o.id)}
              className={`px-3 py-1.5 font-medium transition ${
                origen === o.id
                  ? "bg-primary text-white"
                  : "text-brand-dark/70 hover:bg-primary-light"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button
          onClick={refresh}
          className="rounded-full border border-brand-border bg-surface px-4 py-1.5 text-xs font-medium hover:bg-primary-light"
        >
          🔄
        </button>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {(["todos", ...STATUS_OPTIONS] as ("todos" | OrderStatus)[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              filter === f
                ? "bg-primary text-white shadow-sm"
                : "border border-brand-border bg-surface text-brand-dark hover:border-primary"
            }`}
          >
            {f === "todos" ? "Todos" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {loading && <p className="py-8 text-center text-brand-dark/60">Cargando…</p>}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
          {error}
        </div>
      )}
      {!loading && visible.length === 0 && (
        <div className="rounded-2xl border border-brand-border bg-surface p-10 text-center font-serif text-xl text-brand-dark">
          No hay pedidos.
        </div>
      )}

      <div className="space-y-3">
        {visible.map((o) => (
          <article
            key={o.id}
            className="rounded-xl border border-brand-border bg-surface p-4 transition hover:shadow-md"
          >
            <header className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-brand-dark/50">
                  #{o.id.slice(0, 6)}
                </span>
                <span className="text-xs text-brand-dark/60">
                  {formatDate(o.createdAt)}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    o.origin === "vendedor"
                      ? "bg-violet-100 text-violet-800"
                      : "bg-cyan-100 text-cyan-800"
                  }`}
                >
                  {o.origin === "vendedor" ? "👤 Vendedor" : "🌐 Web"}
                </span>
                {o.remitoId && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                    🚚 Remitido
                  </span>
                )}
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${STATUS_STYLES[o.status]}`}
              >
                {STATUS_LABEL[o.status]}
              </span>
            </header>

            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start">
              <div>
                <p className="font-semibold text-brand-dark">
                  {o.clienteNombre || "(sin nombre)"}
                  {o.clienteTelefono && (
                    <span className="ml-2 text-sm font-normal text-brand-dark/60">
                      · {o.clienteTelefono}
                    </span>
                  )}
                </p>
                <p className="text-sm text-brand-dark/60">
                  Por: <b>{o.createdByName}</b>
                </p>
                <ul className="mt-2 space-y-0.5 text-sm">
                  {o.items.map((it) => (
                    <li key={it.productId} className="text-brand-dark/80">
                      • {it.cantidad}× {it.nombre}
                      {it.precioVenta > 0 && (
                        <span className="text-brand-dark/55">
                          {" "}
                          — {formatARS(it.precioVenta * it.cantidad)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {o.notas && (
                  <p className="mt-2 text-xs italic text-brand-dark/55">📝 {o.notas}</p>
                )}
              </div>
              <div className="text-right">
                <p className="font-bold text-primary">
                  {o.total > 0 ? formatARS(o.total) : "a confirmar"}
                </p>
                <p className="text-xs text-brand-dark/55">
                  {o.items.length} ítem{o.items.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-brand-border pt-3">
              <span className="self-center text-xs text-brand-dark/50">Estado:</span>
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  disabled={busy === o.id || o.status === s}
                  onClick={() => handleStatus(o.id, s)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition disabled:opacity-50 ${
                    o.status === s
                      ? `${STATUS_STYLES[s]} ring-inset`
                      : "bg-surface text-brand-dark/70 ring-brand-border hover:bg-primary-light"
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
              {!o.remitoId && o.status !== "cancelado" && (
                <button
                  disabled={busy === o.id}
                  onClick={() => handleRemito(o)}
                  className="ml-auto rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  🚚 Generar remito
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

// ==================== FACTURAR ====================
function FacturarView() {
  const { user } = useAuth();
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [numero, setNumero] = useState("");
  const [remito, setRemito] = useState<Remito | null>(null);
  const [tipo, setTipo] = useState<TipoFactura>("B");
  const [consumidorFinal, setConsumidorFinal] = useState(true);
  const [cuit, setCuit] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [condicion, setCondicion] = useState<
    "responsable_inscripto" | "monotributo" | "exento"
  >("responsable_inscripto");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const u1 = subscribeFacturas(setFacturas);
    const u2 = subscribeRemitos(setRemitos);
    return () => {
      u1();
      u2();
    };
  }, []);

  // Búsqueda en vivo por nº de remito (parcial; no hace falta el número completo)
  const coincidencias = useMemo(() => {
    const t = numero.trim();
    if (!t) return [];
    return remitos.filter((r) => coincide(r.numero, t)).slice(0, 8);
  }, [remitos, numero]);

  const esCF = tipo === "B" && consumidorFinal;

  const facturar = async () => {
    if (!remito) return;
    if (remito.anulado) {
      setError(
        "Esta venta está ANULADA: no se puede facturar (sería un CAE de AFIP por una venta que no existe)."
      );
      return;
    }
    if (remito.facturaId) {
      setError("Este remito ya fue facturado.");
      return;
    }
    if (!esCF && !cuit.trim()) {
      setError(
        tipo === "A"
          ? "La Factura A requiere el CUIT del cliente."
          : "Ingresá el CUIT del cliente o marcá consumidor final."
      );
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const f = await emitirFacturaAfip({
        remitoId: remito.id,
        tipo: tipo === "A" ? "A" : "B",
        clienteCuit: esCF ? undefined : cuit.trim() || undefined,
        clienteCondicionIva: esCF
          ? "consumidor_final"
          : tipo === "A"
          ? "responsable_inscripto"
          : condicion,
        clienteNombre: esCF ? undefined : razonSocial.trim() || undefined,
      });
      setMsg(
        `✓ Factura ${f.tipo} ${f.numero} emitida. CAE ${f.cae}.${
          f.yaExistia ? " (ya existía)" : ""
        }`
      );
      void printFactura(f); // abre el PDF con QR
      setRemito(null);
      setNumero("");
      setCuit("");
      setRazonSocial("");
    } catch (e) {
      console.error(e);
      setError(mensajeFacturaError(e));
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      {/* Emitir */}
      <div className="rounded-2xl border border-brand-border bg-surface p-5">
        <h2 className="mb-1 font-serif text-lg text-brand-dark">
          Facturar un remito
        </h2>
        <p className="mb-3 text-xs text-brand-dark/55">
          Ingresá el nº de remito para traer lo comprado y emitir la factura
          electrónica en <b>AFIP</b> (CAE + QR oficial). Punto de venta 6.
        </p>
        <input
          value={numero}
          onChange={(e) => {
            setNumero(e.target.value);
            setRemito(null);
            setError(null);
            setMsg(null);
          }}
          placeholder="Escribí el nº de remito (ej. 1, o R-000001)…"
          className={inputCls}
        />
        {!remito && coincidencias.length > 0 && (
          <div className="mt-1 overflow-hidden rounded-lg border border-brand-border">
            {coincidencias.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setRemito(r);
                  setNumero(r.numero);
                }}
                className="flex w-full items-center justify-between gap-2 border-b border-brand-border/60 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-primary-light/40"
              >
                <span className="min-w-0 truncate">
                  <b>{r.numero}</b>{" "}
                  <span className="text-brand-dark/55">
                    {r.clienteNombre || "(sin nombre)"}
                  </span>
                  {r.anulado && (
                    <span className="ml-1 text-[10px] font-bold uppercase text-rose-700">
                      · ANULADA
                    </span>
                  )}
                  {r.facturaId && (
                    <span className="ml-1 text-[10px] font-bold uppercase text-sky-700">
                      · facturado
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-semibold text-primary">
                  {formatARS(r.total)}
                </span>
              </button>
            ))}
          </div>
        )}
        {!remito && numero.trim() !== "" && coincidencias.length === 0 && (
          <p className="mt-1 text-xs text-brand-dark/45">
            No hay remitos que coincidan con “{numero}”.
          </p>
        )}

        {remito && (
          <div className="mt-4 rounded-lg border border-brand-border bg-primary-light/20 p-3">
            <p className="text-sm font-semibold">
              {remito.numero} · {remito.clienteNombre || "(sin nombre)"}
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-brand-dark/75">
              {remito.items.map((it) => (
                <li key={it.productId}>
                  • {it.cantidad}× {it.nombre} —{" "}
                  {formatARS(it.precioVenta * it.cantidad)}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-right text-sm font-bold text-primary">
              Total: {formatARS(remito.total)}
            </p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase text-brand-dark/55">
                  Tipo
                </span>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TipoFactura)}
                  className={inputCls}
                >
                  <option value="A">Factura A (a Responsable Inscripto)</option>
                  <option value="B">Factura B (consumidor final / otros)</option>
                </select>
              </label>
              {tipo === "B" && (
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={consumidorFinal}
                    onChange={(e) => setConsumidorFinal(e.target.checked)}
                  />
                  Consumidor final
                </label>
              )}
            </div>
            {!esCF && (
              <div className="mt-2 space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    value={cuit}
                    onChange={(e) => setCuit(e.target.value)}
                    placeholder={
                      tipo === "A" ? "CUIT del cliente (obligatorio)" : "CUIT / DNI del cliente"
                    }
                    className={inputCls}
                  />
                  <input
                    value={razonSocial}
                    onChange={(e) => setRazonSocial(e.target.value)}
                    placeholder="Razón social / nombre"
                    className={inputCls}
                  />
                </div>
                {tipo === "B" && (
                  <select
                    value={condicion}
                    onChange={(e) =>
                      setCondicion(e.target.value as typeof condicion)
                    }
                    className={inputCls}
                  >
                    <option value="responsable_inscripto">
                      Cliente: Responsable Inscripto
                    </option>
                    <option value="monotributo">Cliente: Monotributista</option>
                    <option value="exento">Cliente: Exento</option>
                  </select>
                )}
              </div>
            )}

            <button
              onClick={facturar}
              disabled={busy || !!remito.facturaId || !!remito.anulado}
              className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {remito.anulado
                ? "Venta ANULADA — no se puede facturar"
                : remito.facturaId
                ? "Remito ya facturado"
                : busy
                ? "Emitiendo en AFIP…"
                : "Emitir factura AFIP"}
            </button>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {error}
          </p>
        )}
        {msg && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            ✓ {msg}
          </p>
        )}
      </div>

      {/* Facturas emitidas */}
      <div>
        <h2 className="mb-3 font-serif text-lg text-brand-dark">
          Facturas generadas
        </h2>
        {facturas.length === 0 ? (
          <p className="rounded-xl border border-brand-border bg-surface p-6 text-center text-sm text-brand-dark/55">
            Todavía no hay facturas.
          </p>
        ) : (
          <div className="space-y-2">
            {facturas.map((f) => (
              <article
                key={f.id}
                className="rounded-xl border border-brand-border bg-surface p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold">
                    Factura {f.tipo} · {f.numero || f.remitoNumero}
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        f.estado === "emitida"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {f.estado === "emitida" ? "AFIP" : "interna"}
                    </span>
                  </p>
                  <span className="font-bold text-primary">
                    {formatARS(f.total)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-brand-dark/55">
                    {formatDate(f.fecha)} ·{" "}
                    {f.consumidorFinal ? "Consumidor final" : `CUIT ${f.cuit}`}
                  </p>
                  <button
                    onClick={() => printFactura(f)}
                    className="rounded-lg border border-brand-border px-3 py-1 text-xs font-medium hover:bg-primary-light"
                  >
                    🖨️ Imprimir factura
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
