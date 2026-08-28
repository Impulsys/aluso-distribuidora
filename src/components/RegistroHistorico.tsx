"use client";

import { useEffect, useMemo, useState } from "react";
import {
  subscribeRemitosRange,
  updateRemitoMeta,
  registrarDevolucion,
  editarItemsRemito,
} from "@/lib/ventas";
import type { RemitoItem } from "@/lib/types";
import { totalNetoRemito } from "@/lib/cobros";
import { LOGISTICA_POR_EAN } from "@/data/logistica";
import {
  subscribeSupplierPaymentsRange,
  subscribeProveedores,
} from "@/lib/cuentas";
import { subscribeExpensesRange } from "@/lib/cashflow";
import { getAllUsers } from "@/lib/admin";
import { subscribeCierres, type DailyCashInitial } from "@/lib/cash-initial";
import { DENOMINACIONES, totalArqueo } from "@/lib/caja";
import {
  openRemito,
  printRemito,
  printRemitoTransporte,
  printRemitoPreimpreso,
} from "@/lib/remito-print";
import { formatARS, formatDate, formatGasto, tsFromISO } from "@/lib/format";
import {
  EXPENSE_LABELS,
  type DailyExpense,
  type FormaPago,
  type Proveedor,
  type Remito,
  type SupplierPayment,
} from "@/lib/types";

const VIA_LABELS: Record<string, string> = {
  deposito: "Depósito bancario",
  transferencia: "Transferencia",
  agencia: "Financiera / agencia",
  efectivo: "Efectivo",
  banco: "Banco",
  financiera: "Financiera",
};

function detallePago(pg: SupplierPayment): string | null {
  if (pg.via === "transferencia") {
    const partes = [
      pg.transferNumero && `Nº ${pg.transferNumero}`,
      pg.transferBanco,
      pg.transferTitular,
    ].filter(Boolean);
    return partes.length ? partes.join(" · ") : null;
  }
  if (pg.via === "deposito") {
    const partes: string[] = [];
    if (pg.depositoCuenta) partes.push(`Cuenta ${pg.depositoCuenta}`);
    if (pg.depositoTitular) partes.push(pg.depositoTitular);
    const bil = pg.arqueoDeposito ? totalArqueo(pg.arqueoDeposito) : 0;
    if (bil > 0) partes.push(`billetes ${formatARS(bil)}`);
    return partes.length ? partes.join(" · ") : null;
  }
  return null;
}

function hora(ts: number): string {
  return new Date(ts).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function RegistroHistorico() {
  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [gastos, setGastos] = useState<DailyExpense[]>([]);
  const [pagos, setPagos] = useState<SupplierPayment[]>([]);
  const [cierres, setCierres] = useState<DailyCashInitial[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [usuarios, setUsuarios] = useState<Record<string, string>>({});
  const [abierto, setAbierto] = useState<number | null>(null);
  const [mesesAtras, setMesesAtras] = useState(3);
  const [editVenta, setEditVenta] = useState<Remito | null>(null);
  const [devVenta, setDevVenta] = useState<Remito | null>(null);

  useEffect(() => {
    getAllUsers()
      .then((us) => {
        const m: Record<string, string> = {};
        us.forEach((u) => (m[u.uid] = u.displayName));
        setUsuarios(m);
      })
      .catch(() => {});
  }, []);

  // Solo cargamos los últimos N meses (no toda la historia) para no bajar todo.
  const desde = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth() - (mesesAtras - 1), 1).getTime();
  }, [mesesAtras]);

  useEffect(() => {
    const hasta = Date.now() + 86_400_000;
    const u1 = subscribeRemitosRange(desde, hasta, setRemitos);
    const u2 = subscribeExpensesRange(desde, hasta, setGastos);
    const u3 = subscribeSupplierPaymentsRange(desde, hasta, setPagos);
    const u4 = subscribeCierres(setCierres);
    const u5 = subscribeProveedores(setProveedores);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
    };
  }, [desde]);

  const proveedorById = useMemo(() => {
    const m: Record<string, string> = {};
    proveedores.forEach((p) => (m[p.id] = p.nombre));
    return m;
  }, [proveedores]);

  const dias = useMemo(() => {
    const cierreMap = new Map<number, DailyCashInitial>();
    cierres.forEach((c) => cierreMap.set(startOfDay(c.fecha), c));

    const keys = new Set<number>();
    remitos.forEach((r) => keys.add(startOfDay(r.fecha)));
    gastos.forEach((g) => keys.add(startOfDay(g.fecha)));
    pagos.forEach((p) => keys.add(startOfDay(p.fecha)));
    // Solo cierres dentro de la ventana cargada (los demás no tienen movimientos a la vista).
    cierres
      .filter((c) => c.fecha >= desde)
      .forEach((c) => keys.add(startOfDay(c.fecha)));

    return [...keys]
      .sort((a, b) => b - a)
      .map((day) => {
        const ventas = remitos
          .filter((r) => startOfDay(r.fecha) === day)
          .sort((a, b) => b.fecha - a.fecha);
        const egresos = gastos
          .filter((g) => startOfDay(g.fecha) === day)
          .sort((a, b) => b.fecha - a.fecha);
        const pagosDia = pagos
          .filter((p) => startOfDay(p.fecha) === day)
          .sort((a, b) => b.fecha - a.fecha);
        const validas = ventas.filter((r) => !r.anulado);
        return {
          day,
          ventas,
          egresos,
          pagos: pagosDia,
          cierre: cierreMap.get(day) ?? null,
          totalVentas: validas.reduce((s, r) => s + r.total, 0),
          count: validas.length,
        };
      });
  }, [remitos, gastos, pagos, cierres, desde]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-serif text-xl text-brand-dark">
            Registro histórico de cajas
          </h2>
          <p className="text-sm text-brand-dark/60">
            Cada día con sus ventas, egresos, pagos y el cierre de caja (con el
            arqueo de billetes). Abrí o imprimí cada remito.
          </p>
          <p className="mt-0.5 text-xs text-brand-dark/45">
            Mostrando desde {formatDate(desde)}.
          </p>
        </div>
        <button
          onClick={() => setMesesAtras((m) => m + 3)}
          className="rounded-lg border border-brand-border bg-surface px-3 py-1.5 text-sm font-medium text-brand-dark hover:bg-primary-light"
        >
          Ver más atrás
        </button>
      </div>

      {dias.length === 0 ? (
        <p className="rounded-2xl border border-brand-border bg-surface p-8 text-center text-brand-dark/60">
          Todavía no hay movimientos registrados.
        </p>
      ) : (
        dias.map((dia) => {
          const open = abierto === dia.day;
          return (
            <article
              key={dia.day}
              className="overflow-hidden rounded-2xl border border-brand-border bg-surface"
            >
              <button
                onClick={() => setAbierto(open ? null : dia.day)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-primary-light/30"
              >
                <span className="flex items-center gap-2">
                  <span className="text-brand-dark/40">{open ? "▲" : "▼"}</span>
                  <span className="font-semibold capitalize text-brand-dark">
                    {formatDate(dia.day)}
                  </span>
                  <span className="text-xs text-brand-dark/55">
                    · {dia.count} venta{dia.count === 1 ? "" : "s"}
                  </span>
                  {dia.cierre?.cerrado && (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                      cerrada
                    </span>
                  )}
                </span>
                <span className="font-serif text-lg text-emerald-700">
                  {formatARS(dia.totalVentas)}
                </span>
              </button>

              {open && (
                <div className="space-y-4 border-t border-brand-border p-4">
                  {/* Cierre de caja */}
                  <CierreResumen cierre={dia.cierre} nombres={usuarios} />

                  {/* Ventas */}
                  <Seccion titulo={`Ventas (${dia.ventas.length})`}>
                    {dia.ventas.length === 0 ? (
                      <Vacio>Sin ventas.</Vacio>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-brand-border">
                        <table className="w-full min-w-[460px] text-xs">
                          <thead className="bg-primary-light/40 text-[10px] uppercase text-primary">
                            <tr>
                              <th className="px-3 py-1.5 text-left">Hora</th>
                              <th className="px-3 py-1.5 text-left">Remito</th>
                              <th className="px-3 py-1.5 text-left">Cliente</th>
                              <th className="px-3 py-1.5 text-right">Total</th>
                              <th className="px-3 py-1.5 text-right">Doc.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dia.ventas.map((r) => (
                              <tr
                                key={r.id}
                                className={`border-t border-brand-border/50 ${
                                  r.anulado ? "bg-rose-50/40" : ""
                                }`}
                              >
                                <td className="px-3 py-1.5 text-brand-dark/70">
                                  {hora(r.fecha)}
                                </td>
                                <td className="px-3 py-1.5 font-medium text-brand-dark">
                                  {r.numero}
                                  {r.anulado && (
                                    <span className="ml-1 rounded bg-rose-100 px-1 text-[9px] font-bold uppercase text-rose-700">
                                      anulado
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-1.5 text-brand-dark/70">
                                  {r.clienteNombre || "Consumidor final"}
                                </td>
                                <td
                                  className={`px-3 py-1.5 text-right font-semibold ${
                                    r.anulado
                                      ? "text-brand-dark/40 line-through"
                                      : "text-emerald-700"
                                  }`}
                                >
                                  {formatARS(r.total)}
                                  {r.devoluciones && r.devoluciones.length > 0 && (
                                    <span className="block text-[10px] font-normal text-amber-700">
                                      ↩️ neto {formatARS(totalNetoRemito(r))}
                                    </span>
                                  )}
                                </td>
                                <td className="whitespace-nowrap px-3 py-1.5 text-right">
                                  <button
                                    onClick={() => openRemito(r)}
                                    className="rounded-full px-2 py-1 text-xs font-medium text-primary ring-1 ring-brand-border hover:bg-primary-light"
                                  >
                                    Ver
                                  </button>
                                  {!r.anulado && (
                                    <button
                                      onClick={() => setEditVenta(r)}
                                      title="Editar datos"
                                      className="ml-1 rounded-full px-2 py-1 text-xs hover:bg-primary-light"
                                    >
                                      ✎
                                    </button>
                                  )}
                                  {!r.anulado && (
                                    <button
                                      onClick={() => setDevVenta(r)}
                                      title="Registrar devolución (volvió un bulto)"
                                      className="ml-1 rounded-full px-2 py-1 text-xs hover:bg-amber-100"
                                    >
                                      ↩️
                                    </button>
                                  )}
                                  <button
                                    onClick={() => printRemito(r)}
                                    title="Imprimir remito (con precios)"
                                    className="ml-1 rounded-full px-2 py-1 text-xs hover:bg-primary-light"
                                  >
                                    🖨️
                                  </button>
                                  <button
                                    onClick={() => printRemitoTransporte(r)}
                                    title="Remito del camionero (sin precios, x2)"
                                    className="ml-1 rounded-full px-2 py-1 text-xs hover:bg-primary-light"
                                  >
                                    🚚
                                  </button>
                                  <button
                                    onClick={() => printRemitoPreimpreso(r)}
                                    title="Imprimir SOBRE el formulario preimpreso (talonario numerado)"
                                    className="ml-1 rounded-full px-2 py-1 text-xs hover:bg-primary-light"
                                  >
                                    📄
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Seccion>

                  {/* Egresos */}
                  <Seccion titulo={`Egresos (${dia.egresos.length})`}>
                    {dia.egresos.length === 0 ? (
                      <Vacio>Sin egresos.</Vacio>
                    ) : (
                      <ul className="divide-y divide-brand-border/50 rounded-lg border border-brand-border">
                        {dia.egresos.map((g) => (
                          <li
                            key={g.id}
                            className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs"
                          >
                            <span className="text-brand-dark/75">
                              <b className="text-brand-dark">
                                {EXPENSE_LABELS[g.tipo] ?? g.tipo}
                              </b>
                              {g.detalle ? ` · ${g.detalle}` : ""}
                            </span>
                            <span
                              className={`font-semibold ${
                                g.monto < 0 ? "text-emerald-700" : "text-rose-700"
                              }`}
                            >
                              {formatGasto(g.monto)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Seccion>

                  {/* Pagos a proveedores */}
                  <Seccion titulo={`Pagos a proveedores (${dia.pagos.length})`}>
                    {dia.pagos.length === 0 ? (
                      <Vacio>Sin pagos.</Vacio>
                    ) : (
                      <ul className="divide-y divide-brand-border/50 rounded-lg border border-brand-border">
                        {dia.pagos.map((p) => (
                          <li
                            key={p.id}
                            className="flex items-start justify-between gap-2 px-3 py-1.5 text-xs"
                          >
                            <span className="text-brand-dark/75">
                              <b className="text-brand-dark">
                                {proveedorById[p.proveedorId] ?? "Proveedor"}
                              </b>{" "}
                              · {VIA_LABELS[p.via ?? ""] ?? p.via ?? "—"}
                              {p.comisionMonto
                                ? ` (${p.comisionMonto > 0 ? "+" : ""}${formatARS(
                                    p.comisionMonto
                                  )} com.)`
                                : ""}
                              {detallePago(p) && (
                                <span className="block text-[10px] text-brand-dark/45">
                                  {detallePago(p)}
                                </span>
                              )}
                            </span>
                            <span className="font-semibold text-rose-700">
                              −{formatARS(p.monto)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Seccion>
                </div>
              )}
            </article>
          );
        })
      )}

      {editVenta && (
        <EditarVentaModal
          venta={editVenta}
          onCancel={() => setEditVenta(null)}
          onSave={async (patch) => {
            try {
              await updateRemitoMeta(editVenta.id, patch);
              setEditVenta(null);
            } catch {
              alert("No se pudo actualizar la venta.");
            }
          }}
        />
      )}

      {devVenta && (
        <DevolucionModal
          venta={devVenta}
          onCancel={() => setDevVenta(null)}
          onDone={() => setDevVenta(null)}
        />
      )}
    </div>
  );
}

// ====== Modal: registrar una DEVOLUCIÓN parcial de un remito ======
// Devuelve stock (salvo entrega de fábrica) y baja la deuda del cliente.
function DevolucionModal({
  venta,
  onCancel,
  onDone,
}: {
  venta: Remito;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [productId, setProductId] = useState(venta.items[0]?.productId ?? "");
  const [bultos, setBultos] = useState(1);
  const [busy, setBusy] = useState(false);

  const item = venta.items.find((i) => i.productId === productId);
  const paq =
    item &&
    (item.paqPorBulto && item.paqPorBulto > 0
      ? item.paqPorBulto
      : LOGISTICA_POR_EAN[item.productId]?.paqPorBulto || 1);
  const paqN = paq || 1;
  const yaDevuelto = (venta.devoluciones ?? [])
    .filter((d) => d.productId === productId)
    .reduce((s, d) => s + d.cantidad, 0);
  const maxUnidades = (item?.cantidad ?? 0) - yaDevuelto;
  const unidades = bultos * paqN;
  const monto = (item?.precioVenta ?? 0) * unidades;
  const excede = unidades > maxUnidades;

  const confirmar = async () => {
    if (!item || unidades <= 0 || excede) return;
    setBusy(true);
    try {
      await registrarDevolucion(venta, productId, unidades);
      onDone();
    } catch (e) {
      console.error(e);
      alert("No se pudo registrar la devolución.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl">
        <h3 className="font-serif text-lg text-brand-dark">
          Devolución · {venta.numero}
        </h3>
        <p className="mb-3 text-xs text-brand-dark/55">
          Elegí el producto y cuántos <b>bultos</b> volvieron. Se suma ese stock
          de vuelta{venta.sinStock ? " (esta venta no descontó stock, así que solo baja la deuda)" : ""} y se le baja la deuda al cliente.
        </p>

        <label className="block text-sm">
          <span className="font-medium text-brand-dark">Producto</span>
          <select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setBultos(1);
            }}
            className="mt-1 w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm"
          >
            {venta.items.map((it) => (
              <option key={it.productId} value={it.productId}>
                {it.codigo ? `${it.codigo} · ` : ""}
                {it.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block text-sm">
          <span className="font-medium text-brand-dark">Bultos que volvieron</span>
          <input
            type="number"
            min={1}
            value={bultos || ""}
            onChange={(e) => setBultos(Math.max(0, Number(e.target.value) || 0))}
            className="mt-1 w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-[11px] text-brand-dark/55">
            {paqN} u/bulto · = {unidades} unidades · máximo{" "}
            {Math.floor(maxUnidades / paqN)} bultos ({maxUnidades} u)
          </span>
        </label>

        {excede && (
          <p className="mt-2 text-xs font-semibold text-rose-600">
            No podés devolver más de lo que había en el remito.
          </p>
        )}

        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Se le descuenta al cliente: <b>{formatARS(monto)}</b>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-brand-border px-4 py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={busy || excede || unidades <= 0}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Registrando…" : "Registrar devolución"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ====== Modal: editar datos de una venta (no toca ítems ni stock) ======
function EditarVentaModal({
  venta,
  onCancel,
  onSave,
}: {
  venta: Remito;
  onCancel: () => void;
  onSave: (patch: {
    clienteNombre: string;
    formaPago: FormaPago;
    fecha: number;
  }) => void | Promise<void>;
}) {
  const isoDe = (ts: number) => {
    const d = new Date(ts);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const [cliente, setCliente] = useState(venta.clienteNombre ?? "");
  const [formaPago, setFormaPago] = useState<FormaPago>(
    venta.formaPago ?? "efectivo"
  );
  const [fecha, setFecha] = useState(isoDe(venta.fecha));
  const [busy, setBusy] = useState(false);
  // Edición de ítems: solo si la venta NO está facturada ni anulada.
  const editable = !venta.facturaId && !venta.anulado;
  const [items, setItems] = useState<RemitoItem[]>(
    venta.items.map((it) => ({ ...it }))
  );
  const paqDe = (it: RemitoItem) =>
    it.paqPorBulto && it.paqPorBulto > 0
      ? it.paqPorBulto
      : LOGISTICA_POR_EAN[it.productId]?.paqPorBulto || 1;

  const inputCls =
    "w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary";
  const labelCls =
    "mb-1 block text-[11px] font-bold uppercase tracking-wider text-brand-dark/55";

  const setBultos = (productId: string, bultos: number) =>
    setItems((its) =>
      its.map((it) =>
        it.productId === productId
          ? { ...it, cantidad: Math.max(0, Math.round(bultos)) * paqDe(it) }
          : it
      )
    );
  const quitar = (productId: string) =>
    setItems((its) => its.filter((it) => it.productId !== productId));

  const itemsCambiaron =
    JSON.stringify(items.map((i) => [i.productId, i.cantidad])) !==
    JSON.stringify(venta.items.map((i) => [i.productId, i.cantidad]));

  const guardar = async () => {
    const finales = items.filter((it) => it.cantidad > 0);
    if (editable && finales.length === 0) {
      alert("La venta tiene que quedar con al menos un producto.");
      return;
    }
    setBusy(true);
    try {
      if (editable && itemsCambiaron) {
        await editarItemsRemito(venta, finales);
      }
      await onSave({ clienteNombre: cliente, formaPago, fecha: tsFromISO(fecha) });
    } catch {
      alert("No se pudo guardar. Revisá e intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-brand-border p-5">
          <h2 className="font-serif text-xl text-brand-dark">
            Editar venta {venta.numero}
          </h2>
          <p className="mt-0.5 text-xs text-brand-dark/55">
            {editable
              ? "Podés cambiar cantidades (en bultos) y sacar productos. El stock y el total se ajustan solos."
              : "Esta venta está facturada o anulada: solo se pueden editar los datos, no los productos."}
          </p>
        </div>
        <div className="space-y-3 p-5">
          <div>
            <label className={labelCls}>Cliente</label>
            <input
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Consumidor final"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Forma de pago</label>
              <select
                value={formaPago}
                onChange={(e) => setFormaPago(e.target.value as FormaPago)}
                className={inputCls}
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {editable && (
            <div>
              <label className={labelCls}>Productos (cantidad en bultos)</label>
              <ul className="space-y-1">
                {items.map((it) => {
                  const paq = paqDe(it);
                  const bultos = Math.round(it.cantidad / paq);
                  return (
                    <li
                      key={it.productId}
                      className="flex items-center gap-2 rounded-lg border border-brand-border bg-white px-2 py-1.5 text-xs"
                    >
                      <span className="flex-1 truncate">
                        {it.codigo ? `${it.codigo} · ` : ""}
                        {it.nombre}
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={bultos || ""}
                        onChange={(e) =>
                          setBultos(it.productId, Number(e.target.value) || 0)
                        }
                        className="w-16 rounded border border-brand-border px-1.5 py-1 text-center tabular-nums"
                      />
                      <span className="w-20 shrink-0 text-[10px] text-brand-dark/55">
                        = {it.cantidad} u
                      </span>
                      <button
                        onClick={() => quitar(it.productId)}
                        title="Sacar del remito"
                        className="shrink-0 text-brand-dark/40 hover:text-rose-600"
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
              {itemsCambiaron && (
                <p className="mt-1.5 text-[11px] font-semibold text-amber-700">
                  ⚠ Cambiaste productos: al guardar se ajusta el stock y el total.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="rounded-lg border border-brand-border px-4 py-2 text-sm font-medium hover:bg-primary-light"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={busy}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {busy ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">
        {titulo}
      </p>
      {children}
    </div>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-brand-dark/45">{children}</p>;
}

function nombreDe(
  cerradoPor: string | undefined,
  nombres: Record<string, string>
): string | null {
  if (!cerradoPor) return null;
  if (nombres[cerradoPor]) return nombres[cerradoPor];
  // Si parece un UID (largo y alfanumérico sin espacios), no lo mostramos.
  if (cerradoPor.length >= 20 && /^[A-Za-z0-9]+$/.test(cerradoPor)) return null;
  return cerradoPor;
}

function CierreResumen({
  cierre,
  nombres,
}: {
  cierre: DailyCashInitial | null;
  nombres: Record<string, string>;
}) {
  if (!cierre) {
    return (
      <Seccion titulo="Cierre de caja">
        <Vacio>Esta caja no se cerró.</Vacio>
      </Seccion>
    );
  }
  const cerradoPorNombre = nombreDe(cierre.cerradoPor, nombres);
  const billetes = DENOMINACIONES.filter((d) => (cierre.arqueo?.[d] ?? 0) > 0);
  const contado =
    cierre.efectivoContado ?? totalArqueo(cierre.arqueo ?? {});
  const esperado = cierre.efectivoEsperado ?? 0;
  const dif = cierre.diferencia ?? contado - esperado;

  return (
    <Seccion titulo="Cierre de caja">
      <div className="rounded-lg border border-brand-border bg-slate-50/60 p-3 text-xs">
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
              cierre.cerrado
                ? "bg-slate-200 text-slate-700"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {cierre.cerrado ? "Cerrada" : "Abierta / sin cerrar"}
          </span>
          {cierre.cerrado && cierre.cerradoAt && (
            <span className="text-brand-dark/55">
              Cerrada el {formatDate(cierre.cerradoAt)}
              {cerradoPorNombre ? ` · por ${cerradoPorNombre}` : ""}
            </span>
          )}
        </div>

        {/* Billetes del arqueo */}
        {billetes.length > 0 && (
          <div className="mb-2">
            <p className="mb-1 text-[10px] font-bold uppercase text-brand-dark/45">
              Billetes contados
            </p>
            <div className="flex flex-wrap gap-1.5">
              {billetes.map((d) => (
                <span
                  key={d}
                  className="rounded-md border border-brand-border bg-white px-2 py-1 text-[11px] text-brand-dark/70"
                >
                  <b className="text-brand-dark">{cierre.arqueo?.[d]}</b> ×{" "}
                  {formatARS(d)}
                  <span className="text-brand-dark/45">
                    {" "}
                    = {formatARS(d * (cierre.arqueo?.[d] ?? 0))}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-0.5 border-t border-brand-border pt-2">
          <Fila label="Caja inicial" value={formatARS(cierre.cajaInicial ?? 0)} />
          <Fila label="Efectivo esperado" value={formatARS(esperado)} />
          <Fila label="Efectivo contado" value={formatARS(contado)} bold />
          <Fila
            label="Diferencia"
            value={formatARS(dif)}
            tone={dif === 0 ? undefined : dif > 0 ? "emerald" : "rose"}
            bold
          />
        </div>
      </div>
    </Seccion>
  );
}

function Fila({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: "emerald" | "rose";
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "rose"
      ? "text-rose-700"
      : "text-brand-dark";
  return (
    <div className="flex items-center justify-between">
      <span className="text-brand-dark/60">{label}</span>
      <span className={`${bold ? "font-bold" : ""} ${color}`}>{value}</span>
    </div>
  );
}
