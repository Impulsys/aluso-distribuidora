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
import { printFactura, openFactura } from "@/lib/factura-print";
import { emitirFacturaAfip, mensajeFacturaError } from "@/lib/factura-afip";
import CajaView from "@/components/CajaView";
import RegistroHistorico from "@/components/RegistroHistorico";
import { useAuth } from "@/context/AuthContext";
import { formatARS, formatDate } from "@/lib/format";
import { coincide } from "@/lib/search";
import { LOGISTICA_POR_EAN } from "@/data/logistica";
import { descuentosVenta, precioParaLista, MARKUP_DISTRIBUIDOR } from "@/lib/precios";
import {
  DEFAULT_PRECIOS_CONFIG,
  subscribePreciosConfig,
} from "@/lib/preciosConfig";
import { subscribeClientes } from "@/lib/clientes";
import { getAllUsers } from "@/lib/admin";
import type { Cliente, AppUser } from "@/lib/types";
import type {
  Factura,
  FormaPago,
  Order,
  OrderStatus,
  Remito,
  RemitoItem,
  TipoFactura,
} from "@/lib/types";

// ALUSO no usa cheques (confirmado por el cliente): las formas de pago son
// efectivo y transferencia. El tipo "cheque" sigue existiendo en FormaPago por
// compatibilidad con datos viejos, pero no se ofrece.
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
  const [cartCount, setCartCount] = useState(0);

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
            {t.id === "nueva" && cartCount > 0 && (
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  tab === "nueva"
                    ? "bg-white/25 text-white"
                    : "bg-amber-100 text-amber-800"
                }`}
                title="Tenés una venta sin cerrar"
              >
                {cartCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/*
        La venta en curso NO se desmonta: queda oculta. Si se desmonta, el
        carrito se pierde entero — el vendedor se iba a Caja a mirar un dato,
        volvía, y tenía que cargar los 20 productos otra vez.
      */}
      <div className={tab === "nueva" ? undefined : "hidden"}>
        <NuevaVentaView onCartCount={setCartCount} />
      </div>
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
  /**
   * Unidades (paquetes) que trae un bulto cerrado. ALUSO vende SIEMPRE por
   * bulto: la cantidad se maneja en bultos y `cantidad` (unidades) = bultos ×
   * paqPorBulto. El precio se carga por unidad y el del bulto se calcula solo.
   * Si el producto no tiene el dato, es 1 (se vende por unidad).
   */
  paqPorBulto: number;
}

function NuevaVentaView({
  onCartCount,
}: {
  onCartCount?: (n: number) => void;
}) {
  const { user } = useAuth();
  const productos = useProducts();
  const [costs, setCosts] = useState<Record<string, number>>({});
  // Sin los costos cargados, el remito guardaría costoUnitario 0 y el margen de
  // esa venta queda roto PARA SIEMPRE (los ítems del remito son inmutables).
  const [costsListo, setCostsListo] = useState(false);
  // Cliente de la venta: se elige del CRM (obligatorio) para poder ver a fin de
  // mes cuántos pedidos y la deuda de cada uno (pedido de Luciano).
  const [clienteId, setClienteId] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  // Vendedor al que se le atribuye la venta (para la comisión).
  const [vendedorId, setVendedorId] = useState("");
  const [vendedores, setVendedores] = useState<AppUser[]>([]);
  // Arranca en "transferencia" para que el descuento de efectivo NO se aplique
  // solo (pedido de Anabela). El operador pone "efectivo" cuando el cliente paga
  // en mano, y ahí sí entra el 2,5%.
  const [formaPago, setFormaPago] = useState<FormaPago>("transferencia");
  // Condiciones de descuento que el operador confirma al cerrar la venta.
  const [retiraDeposito, setRetiraDeposito] = useState(false);
  const [porVolumen, setPorVolumen] = useState(false);
  // Descuento adicional a mano (el "+" que pidió Luciano).
  const [descAdicional, setDescAdicional] = useState(0);
  const [descAdicOpen, setDescAdicOpen] = useState(false);
  const [cfgPrecios, setCfgPrecios] = useState(DEFAULT_PRECIOS_CONFIG);
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<POSLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // La pestaña muestra cuántos ítems hay en la venta abierta (la vista queda
  // montada pero oculta al cambiar de solapa).
  useEffect(() => {
    onCartCount?.(lines.length);
  }, [lines.length, onCartCount]);

  // BORRADOR: la venta a medias se guarda en el navegador (pedido de Luciano:
  // "que quede en borrador como los mails"). Sobrevive a cambiar de solapa,
  // cerrar la pestaña o recargar. Se limpia al generar el remito.
  const [borradorListo, setBorradorListo] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pos_borrador");
      if (raw) {
        const b = JSON.parse(raw);
        if (Array.isArray(b.lines)) setLines(b.lines);
        if (b.clienteId) setClienteId(b.clienteId);
        if (b.vendedorId) setVendedorId(b.vendedorId);
      }
    } catch {}
    setBorradorListo(true);
  }, []);
  useEffect(() => {
    if (!borradorListo) return;
    if (lines.length === 0 && !clienteId && !vendedorId) {
      localStorage.removeItem("pos_borrador");
    } else {
      localStorage.setItem(
        "pos_borrador",
        JSON.stringify({ lines, clienteId, vendedorId })
      );
    }
  }, [lines, clienteId, vendedorId, borradorListo]);

  useEffect(
    () =>
      subscribeProductCosts((c) => {
        setCosts(c);
        setCostsListo(true);
      }),
    []
  );

  useEffect(() => subscribePreciosConfig(setCfgPrecios), []);
  useEffect(() => subscribeClientes(setClientes), []);
  useEffect(() => {
    getAllUsers()
      .then((us) => setVendedores(us.filter((u) => u.role === "vendedor")))
      .catch(() => {});
  }, []);

  const clienteSel = clientes.find((c) => c.id === clienteId);

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
    // Cuántas unidades trae el bulto (para vender por bulto cerrado).
    const paq = LOGISTICA_POR_EAN[p.ean ?? p.id]?.paqPorBulto || 1;
    if (lines.some((l) => l.productId === id)) {
      // Sumar de a UN bulto (paq unidades).
      setLines((prev) =>
        prev.map((l) =>
          l.productId === id
            ? { ...l, cantidad: l.cantidad + (l.paqPorBulto || 1) }
            : l
        )
      );
    } else {
      setLines((prev) => [
        ...prev,
        {
          productId: p.id,
          codigo: p.codigo,
          nombre: p.nombre,
          cantidad: paq, // arranca en 1 bulto
          precioVenta: p.precioVenta,
          costoUnitario: costs[p.id] ?? 0,
          stock: p.stock,
          precioLista: p.precioVenta,
          imagen: p.imagen,
          paqPorBulto: paq,
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

  // Lista del cliente: en vez de mostrarla como un descuento "Lista X%" (que le
  // exponía al cliente el precio distribuidor), se BAJA cada renglón a su precio
  // neto. Así el remito muestra directamente el precio del cliente. El precio de
  // catálogo (distribuidor) se sigue editando/guardando aparte.
  // Aplica la lista del cliente para CUALQUIER lista distinta de la distribuidor:
  // las menores (15, 18…) bajan el precio y las mayores ("Locales" 33%) lo suben.
  // precioParaLista maneja los dos casos.
  const markupCli = clienteSel?.markupLista;
  const aplicaLista = markupCli != null && markupCli !== MARKUP_DISTRIBUIDOR;
  const precioNeto = (l: POSLine) =>
    aplicaLista ? precioParaLista(l.precioVenta, markupCli) : l.precioVenta;

  const subtotal = lines.reduce((s, l) => s + precioNeto(l) * l.cantidad, 0);
  const totalItems = lines.reduce((s, l) => s + l.cantidad, 0);
  const totalBultos = lines.reduce(
    (s, l) => s + Math.max(1, Math.round(l.cantidad / (l.paqPorBulto || 1))),
    0
  );

  // Descuentos extra que SÍ se muestran como línea: el fijo del cliente y el
  // adicional a mano. (La lista ya está adentro del precio de cada renglón.)
  const extrasDesc = useMemo(() => {
    const e: { concepto: string; pct: number }[] = [];
    if (clienteSel?.descuentoExtraPct && clienteSel.descuentoExtraPct > 0)
      e.push({ concepto: "Descuento del cliente", pct: clienteSel.descuentoExtraPct });
    if (descAdicional > 0)
      e.push({ concepto: "Descuento adicional", pct: descAdicional });
    return e;
  }, [clienteSel, descAdicional]);

  // Descuentos por condición + extras, en vivo, con la config editable.
  const ventaConDesc = useMemo(
    () =>
      descuentosVenta(
        subtotal,
        { formaPago, retiraEnDeposito: retiraDeposito, porVolumen },
        {
          descuentoEfectivoPct: cfgPrecios.descuentoEfectivoPct,
          descuentoRetiroPct: cfgPrecios.descuentoRetiroPct,
          descuentoVolumenPct: cfgPrecios.descuentoVolumenPct,
          volumenMinBultos: cfgPrecios.volumenMinBultos,
          acumulaSumando: cfgPrecios.acumulaSumando,
        },
        extrasDesc
      ),
    [subtotal, formaPago, retiraDeposito, porVolumen, cfgPrecios, extrasDesc]
  );
  const total = ventaConDesc.total;

  const generar = async () => {
    setError(null);
    setMsg(null);
    // Cliente obligatorio: sin esto no se puede saber a fin de mes cuántos
    // pedidos hizo cada cliente ni su deuda.
    if (!clienteSel) {
      setError("Elegí el cliente de la venta. Si no está en la lista, cargalo primero en la solapa Clientes.");
      return;
    }
    if (!costsListo) {
      setError(
        "Esperá un segundo: se están cargando los costos. Si generás ahora, el margen de esta venta queda mal para siempre."
      );
      return;
    }
    // El remito guarda el PRECIO NETO DEL CLIENTE (su lista ya aplicada en cada
    // renglón), igual que lo que se ve en pantalla. Así el comprobante NO muestra
    // el precio distribuidor ni una línea "Lista X%".
    const items: RemitoItem[] = lines.map((l) => ({
      productId: l.productId,
      codigo: l.codigo,
      nombre: l.nombre,
      cantidad: Math.max(1, Math.floor(Number(l.cantidad) || 0)),
      precioVenta: Math.max(0, precioNeto(l) || 0),
      costoUnitario: l.costoUnitario,
    }));
    const totalCalc = items.reduce((s, it) => s + it.precioVenta * it.cantidad, 0);
    if (items.length === 0 || totalCalc <= 0) {
      setError("Agregá al menos un producto con cantidad y precio válidos.");
      return;
    }
    // Aviso: ítems a $0 se entregan GRATIS y descuentan stock igual.
    const sinPrecio = items.filter((it) => it.precioVenta <= 0);
    if (sinPrecio.length > 0) {
      const ok = confirm(
        `⚠️ Hay ${sinPrecio.length} producto(s) con precio $0:\n\n` +
          sinPrecio.map((i) => `· ${i.nombre}`).join("\n") +
          `\n\nSe entregan GRATIS y se descuentan del stock igual.\n\n¿Generar el remito así?`
      );
      if (!ok) return;
    }
    setBusy(true);
    // Abrimos la ventana YA (en el gesto del click) para que no la bloquee el
    // navegador; la rellenamos cuando el remito esté creado.
    const printWin = window.open("", "_blank", "width=900,height=1000");
    try {
      const vend = vendedores.find((v) => v.uid === vendedorId);
      const r = await crearRemitoDirecto({
        items,
        clienteId: clienteSel.id,
        clienteNombre: clienteSel.nombre,
        clienteCuit: clienteSel.cuit,
        // Vendedor al que se le atribuye la venta (para la comisión). Si no se
        // elige, queda el que la cargó.
        vendedorUid: vend?.uid,
        vendedorNombre: vend?.displayName,
        formaPago,
        // Los descuentos que ve el operador son los que se guardan e imprimen.
        descuentos: descuentosVenta(
          totalCalc,
          { formaPago, retiraEnDeposito: retiraDeposito, porVolumen },
          {
            descuentoEfectivoPct: cfgPrecios.descuentoEfectivoPct,
            descuentoRetiroPct: cfgPrecios.descuentoRetiroPct,
            descuentoVolumenPct: cfgPrecios.descuentoVolumenPct,
            volumenMinBultos: cfgPrecios.volumenMinBultos,
            acumulaSumando: cfgPrecios.acumulaSumando,
          },
          extrasDesc
        ).descuentos,
        createdBy: user?.uid,
      });
      if (printWin) {
        printWin.document.write(remitoHTML(r));
        printWin.document.close();
        printWin.focus();
      }
      setMsg(`Remito ${r.numero} generado. Stock descontado.`);
      setLines([]);
      setClienteId("");
      setVendedorId("");
      setDescAdicional(0);
      setDescAdicOpen(false);
      setFormaPago("efectivo");
      setRetiraDeposito(false);
      setPorVolumen(false);
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
            Carrito · {totalBultos} bulto{totalBultos === 1 ? "" : "s"} · {totalItems} u. · {lines.length} ítem
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
                        {(() => {
                          const paq =
                            LOGISTICA_POR_EAN[p.ean ?? p.id]?.paqPorBulto || 1;
                          if (p.precioVenta <= 0) return `Stock ${p.stock} · sin precio`;
                          return paq > 1
                            ? `${formatARS(p.precioVenta * paq)} /bulto · ${paq} u · ${formatARS(p.precioVenta)} c/u · Stock ${p.stock}`
                            : `${formatARS(p.precioVenta)} · Stock ${p.stock}`;
                        })()}
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

                  {(() => {
                    const paq = l.paqPorBulto || 1;
                    const bultos = Math.max(1, Math.round(l.cantidad / paq));
                    const pn = precioNeto(l); // precio que paga el cliente (con su lista)
                    const precioBulto = pn * paq;
                    return (
                      <>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="inline-flex items-center overflow-hidden rounded-lg border border-brand-border">
                            <button
                              onClick={() =>
                                upd(l.productId, {
                                  cantidad: Math.max(paq, l.cantidad - paq),
                                })
                              }
                              className="grid h-8 w-8 place-items-center text-lg hover:bg-primary-light"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={bultos || ""}
                              onChange={(e) =>
                                upd(l.productId, {
                                  cantidad: Math.max(1, Number(e.target.value)) * paq,
                                })
                              }
                              className="h-8 w-12 border-x border-brand-border text-center text-sm outline-none"
                            />
                            <button
                              onClick={() =>
                                upd(l.productId, { cantidad: l.cantidad + paq })
                              }
                              className="grid h-8 w-8 place-items-center text-lg hover:bg-primary-light"
                            >
                              +
                            </button>
                            <span className="px-2 text-xs font-semibold text-brand-dark/60">
                              {bultos === 1 ? "bulto" : "bultos"}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-xs text-brand-dark/45">
                              {aplicaLista ? "lista $" : "$"}
                            </span>
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
                              placeholder="precio x unidad"
                              title={
                                aplicaLista
                                  ? "Precio de LISTA DISTRIBUIDOR. El cliente paga su lista (ver abajo), no este número."
                                  : "Precio por unidad (el del bulto se calcula solo)"
                              }
                              className={`h-8 w-24 rounded-lg border px-2 text-right text-sm outline-none focus:border-primary ${
                                aplicaLista ? "border-amber-300 bg-amber-50/40" : "border-brand-border"
                              }`}
                            />
                          </div>

                          <span className="ml-auto w-24 text-right text-sm font-bold text-primary">
                            {formatARS(pn * l.cantidad)}
                          </span>
                        </div>

                        {/* Referencia: precio del bulto + unidades por bulto + precio unitario */}
                        <p className="mt-1 text-[11px] text-brand-dark/55">
                          {paq > 1 ? (
                            <>
                              <b className="text-brand-dark">{formatARS(precioBulto)}</b> por bulto ·{" "}
                              {paq} u/bulto · {formatARS(pn)} c/u · {bultos} bulto
                              {bultos === 1 ? "" : "s"} = {l.cantidad} u.
                            </>
                          ) : (
                            <>se vende por unidad (sin dato de bulto) · {l.cantidad} u.</>
                          )}
                        </p>
                        {aplicaLista && (
                          <p className="mt-0.5 text-[11px] text-emerald-700">
                            Precio cliente (lista {markupCli}%) — el de arriba es
                            el de lista distribuidor que se edita/guarda.
                          </p>
                        )}
                      </>
                    );
                  })()}

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
          <div className="flex items-baseline justify-between pb-1">
            <span className="text-sm text-brand-dark/60">Subtotal</span>
            <span className="text-sm font-medium">{formatARS(subtotal)}</span>
          </div>
          {ventaConDesc.descuentos.map((d) => (
            <div
              key={d.concepto}
              className="flex items-baseline justify-between text-sm text-emerald-700"
            >
              <span>
                {d.concepto} ({d.pct}%)
              </span>
              <span>{formatARS(d.monto)}</span>
            </div>
          ))}
          <div className="mt-2 flex items-baseline justify-between border-t border-brand-border pt-2">
            <span className="font-serif text-lg text-brand-dark">TOTAL</span>
            <span className="font-serif text-3xl font-bold text-primary">
              {formatARS(total)}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-brand-border bg-surface p-4">
          <div className="mb-1 flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase text-brand-dark/55">
              Cliente
            </label>
            <a
              href="/admin/clientes"
              target="_blank"
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              + Ver / cargar clientes
            </a>
          </div>
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className={inputCls}
          >
            <option value="">— Elegí el cliente —</option>
            {clientes
              .slice()
              .sort((a, b) => a.nombre.localeCompare(b.nombre))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.razonSocial ? ` · ${c.razonSocial}` : ""}
                </option>
              ))}
          </select>
          {clienteSel &&
            (aplicaLista || (clienteSel.descuentoExtraPct ?? 0) > 0) && (
              <p className="mt-1 text-[11px] text-emerald-700">
                Condición del cliente aplicada
                {aplicaLista ? ` · lista ${markupCli}%` : ""}
                {clienteSel.descuentoExtraPct
                  ? ` · -${clienteSel.descuentoExtraPct}%`
                  : ""}
              </p>
            )}

          <label className="mb-1 mt-3 block text-[11px] font-bold uppercase text-brand-dark/55">
            Vendedor <span className="font-normal normal-case text-brand-dark/40">(para la comisión)</span>
          </label>
          <select
            value={vendedorId}
            onChange={(e) => setVendedorId(e.target.value)}
            className={inputCls}
          >
            <option value="">— Sin vendedor (venta de la casa) —</option>
            {vendedores.map((v) => (
              <option key={v.uid} value={v.uid}>
                {v.displayName}
              </option>
            ))}
          </select>

          <label className="mb-1 mt-3 block text-[11px] font-bold uppercase text-brand-dark/55">
            Forma de pago
          </label>
          <div className="grid grid-cols-2 gap-1">
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

          {/* Descuentos por condición: el operador confirma cuáles aplican y el
              total de arriba se recalcula solo. El de efectivo lo activa la
              forma de pago. */}
          <label className="mb-1 mt-3 block text-[11px] font-bold uppercase text-brand-dark/55">
            Descuentos
          </label>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm text-brand-dark/80">
              <input
                type="checkbox"
                checked={formaPago === "efectivo"}
                readOnly
                disabled
                className="h-4 w-4"
              />
              Pago en efectivo ({cfgPrecios.descuentoEfectivoPct}%)
              <span className="text-xs text-brand-dark/40">
                — según la forma de pago
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm text-brand-dark/80">
              <input
                type="checkbox"
                checked={retiraDeposito}
                onChange={(e) => setRetiraDeposito(e.target.checked)}
                className="h-4 w-4"
              />
              Retira en depósito ({cfgPrecios.descuentoRetiroPct}%)
            </label>
            <label className="flex items-center gap-2 text-sm text-brand-dark/80">
              <input
                type="checkbox"
                checked={porVolumen}
                onChange={(e) => setPorVolumen(e.target.checked)}
                className="h-4 w-4"
              />
              Por volumen +{cfgPrecios.volumenMinBultos} bultos (
              {cfgPrecios.descuentoVolumenPct}%)
            </label>

            {/* Descuento adicional a mano (pedido de Luciano): el "+" abre un
                campo para cargar un % extra sobre este pedido. */}
            {descAdicOpen ? (
              <div className="flex items-center gap-2 text-sm text-brand-dark/80">
                <span className="flex-1">Descuento adicional</span>
                <input
                  type="number"
                  min={0}
                  max={90}
                  step="any"
                  autoFocus
                  value={descAdicional || ""}
                  onChange={(e) =>
                    setDescAdicional(Math.max(0, Number(e.target.value) || 0))
                  }
                  placeholder="0"
                  className="w-16 rounded-lg border border-brand-border px-2 py-1 text-center text-sm outline-none focus:border-primary"
                />
                <span>%</span>
                <button
                  type="button"
                  onClick={() => {
                    setDescAdicional(0);
                    setDescAdicOpen(false);
                  }}
                  className="text-rose-600 hover:text-rose-700"
                  aria-label="Quitar descuento adicional"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setDescAdicOpen(true)}
                className="text-sm font-medium text-primary hover:underline"
              >
                + Agregar descuento adicional
              </button>
            )}
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
                setClienteId("");
                setVendedorId("");
                setDescAdicional(0);
                setDescAdicOpen(false);
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

  // El POS ya tenía esta guarda con el motivo escrito; acá faltaba. Si se
  // genera el remito antes de que llegue el primer snapshot de costos, se
  // guarda costoUnitario 0 y el margen de esa venta queda roto PARA SIEMPRE
  // (los ítems del remito son inmutables) — y contamina todos los reportes.
  const [costsListo, setCostsListo] = useState(false);

  useEffect(() => {
    refresh();
    const unsub = subscribeProductCosts((c) => {
      setCosts(c);
      setCostsListo(true);
    });
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
    // Cancelar un pedido que YA tiene remito no anulaba nada: el remito seguía
    // vivo, el stock descontado y la venta contando en la caja y los reportes.
    // Quedaba un pedido "cancelado" con una venta real detrás.
    const pedido = orders.find((o) => o.id === id);
    if (status === "cancelado" && pedido?.remitoId) {
      alert(
        "Este pedido ya tiene un remito generado y el stock fue descontado.\n\n" +
          "Para cancelarlo hay que anular primero la venta desde Caja; eso " +
          "devuelve el stock y libera el pedido."
      );
      return;
    }
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
    if (!costsListo) {
      alert(
        "Todavía se están cargando los costos.\n\n" +
          "Esperá unos segundos y volvé a intentar: si el remito se genera " +
          "ahora, la venta queda guardada con costo 0 y el margen no se puede " +
          "corregir después."
      );
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
  const [clientesFac, setClientesFac] = useState<Cliente[]>([]);
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
  const [periodo, setPeriodo] = useState<"dia" | "semana" | "mes" | "todo">("mes");

  // Facturas del período elegido (se acumulan y se filtran por día/semana/mes).
  const facturasFiltradas = useMemo(() => {
    const now = new Date();
    let desde = 0;
    if (periodo === "dia") {
      const d = new Date(now); d.setHours(0, 0, 0, 0); desde = d.getTime();
    } else if (periodo === "semana") {
      const d = new Date(now);
      const dow = (d.getDay() + 6) % 7; // lunes = 0
      d.setDate(d.getDate() - dow); d.setHours(0, 0, 0, 0); desde = d.getTime();
    } else if (periodo === "mes") {
      desde = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    }
    return facturas.filter((f) => (f.fecha ?? 0) >= desde);
  }, [facturas, periodo]);
  const totalFacturado = facturasFiltradas.reduce((s, f) => s + (f.total || 0), 0);

  useEffect(() => {
    const u1 = subscribeFacturas(setFacturas);
    const u2 = subscribeRemitos(setRemitos);
    const u3 = subscribeClientes(setClientesFac);
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  // Al elegir un remito, autocompleta CUIT y razón social con lo del cliente
  // (del CRM, o lo que se guardó en el remito). Quedan editables.
  const seleccionarRemito = (r: Remito) => {
    setRemito(r);
    setNumero(r.numero);
    setError(null);
    setMsg(null);
    const cli = clientesFac.find((c) => c.id === r.clienteId);
    const cuitDigits = (cli?.cuit || r.clienteCuit || "").replace(/\D/g, "");
    setCuit(cuitDigits);
    setRazonSocial(cli?.razonSocial || cli?.nombre || r.clienteNombre || "");
    // Si el cliente está identificado con CUIT, no es consumidor final.
    if (cuitDigits.length >= 11) {
      setConsumidorFinal(false);
      if (cli?.condicionIva === "monotributo" || cli?.condicionIva === "exento") {
        setTipo("B");
      } else {
        setTipo("A");
      }
    }
  };

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
        } Quedó guardada abajo en “Facturas generadas”.`
      );
      // Abre la factura para verla. Envuelto para que NUNCA rompa la pantalla:
      // si el navegador bloquea el popup o falla el QR, la venta ya está emitida
      // y la factura queda en la lista de abajo igual.
      openFactura(f).catch((e) => console.error("No se pudo abrir la factura:", e));
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
          electrónica en <b>AFIP</b> (CAE + QR oficial).
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
                onClick={() => seleccionarRemito(r)}
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

      {/* Facturas emitidas — se acumulan acá y se filtran por período */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-lg text-brand-dark">
            Facturas generadas
          </h2>
          <div className="inline-flex rounded-lg border border-brand-border bg-surface p-0.5 text-xs">
            {([
              ["dia", "Día"],
              ["semana", "Semana"],
              ["mes", "Mes"],
              ["todo", "Todas"],
            ] as const).map(([k, lbl]) => (
              <button
                key={k}
                onClick={() => setPeriodo(k)}
                className={`rounded-md px-3 py-1 font-semibold transition ${
                  periodo === k ? "bg-primary text-white" : "text-brand-dark/60 hover:text-brand-dark"
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {facturasFiltradas.length > 0 && (
          <div className="mb-2 flex items-center justify-between rounded-lg bg-primary-light/40 px-3 py-2 text-sm">
            <span className="text-brand-dark/70">
              {facturasFiltradas.length} factura
              {facturasFiltradas.length === 1 ? "" : "s"}
              {periodo !== "todo" ? ` (${periodo === "dia" ? "hoy" : periodo === "semana" ? "esta semana" : "este mes"})` : ""}
            </span>
            <span className="font-bold text-primary">{formatARS(totalFacturado)}</span>
          </div>
        )}

        {facturasFiltradas.length === 0 ? (
          <p className="rounded-xl border border-brand-border bg-surface p-6 text-center text-sm text-brand-dark/55">
            {facturas.length === 0
              ? "Todavía no hay facturas."
              : "No hay facturas en este período. Probá con “Todas”."}
          </p>
        ) : (
          <div className="space-y-2">
            {facturasFiltradas.map((f) => (
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
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-brand-dark/55">
                    {formatDate(f.fecha)} ·{" "}
                    {f.consumidorFinal ? "Consumidor final" : `CUIT ${f.cuit}`}
                    {f.cae ? ` · CAE ${f.cae}` : ""}
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() =>
                        openFactura(f).catch((e) => console.error(e))
                      }
                      className="rounded-lg border border-brand-border px-3 py-1 text-xs font-medium hover:bg-primary-light"
                    >
                      👁️ Ver
                    </button>
                    <button
                      onClick={() =>
                        printFactura(f).catch((e) => console.error(e))
                      }
                      className="rounded-lg border border-brand-border px-3 py-1 text-xs font-medium hover:bg-primary-light"
                    >
                      🖨️ Imprimir
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
