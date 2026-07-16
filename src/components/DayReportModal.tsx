"use client";

import { useEffect, useMemo, useState } from "react";
import { findTruckForDay } from "@/lib/trucks";
import { getExpensesForDay } from "@/lib/cashflow";
import { formatARS } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import {
  DEFAULT_REPORTES_CONFIG,
  subscribeReportesConfig,
  type ReportesConfig,
} from "@/lib/config";
import { subscribeCierre, efectivoEsperadoDelDia } from "@/lib/caja";
import { subscribeSupplierPaymentsRange } from "@/lib/cuentas";
import { useProducts } from "@/hooks/useProducts";
import type { DailyCashInitial } from "@/lib/cash-initial";
import {
  EXPENSE_LABELS,
  type DailyExpense,
  type ExpenseType,
  type Remito,
  type SupplierPayment,
  type Truck,
} from "@/lib/types";

interface Props {
  dayTs: number | null; // EOD del día seleccionado (null = cerrado)
  onClose: () => void;
  trucks: Truck[];
  remitos: Remito[];
}

function dayBounds(ts: number) {
  const d = new Date(ts);
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start: start.getTime(), end: end.getTime(), date: d };
}

const FULL_DATE = (d: Date) =>
  d.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const EXPENSE_TYPES: ExpenseType[] = [
  "impuestos",
  "insumos",
  "mantenimiento",
  "sueldos",
  "fletes",
  "cobertura_cheques",
  "adelantos",
];

export default function DayReportModal({
  dayTs,
  onClose,
  trucks,
  remitos,
}: Props) {
  const { user } = useAuth();
  const productos = useProducts();
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [loadingExp, setLoadingExp] = useState(false);
  const [config, setConfig] = useState<ReportesConfig>(DEFAULT_REPORTES_CONFIG);
  const [cierre, setCierre] = useState<DailyCashInitial | null>(null);
  const [pagos, setPagos] = useState<SupplierPayment[]>([]);

  useEffect(() => {
    const unsub = subscribeReportesConfig(setConfig);
    return unsub;
  }, []);

  // Pagos a proveedores del día: si se pagó con billetes, esa plata SALIÓ de la
  // caja. Sin esto el reporte mostraba más efectivo esperado que la pantalla de
  // Caja para el mismo día.
  useEffect(() => {
    if (dayTs === null) {
      setPagos([]);
      return;
    }
    const { start, end } = dayBounds(dayTs);
    return subscribeSupplierPaymentsRange(start, end + 1, setPagos);
  }, [dayTs]);

  // Cierre de caja del día (solo lectura; el cierre se hace en Ventas → Caja)
  useEffect(() => {
    if (dayTs === null) {
      setCierre(null);
      return;
    }
    const unsub = subscribeCierre(dayTs, setCierre);
    return unsub;
  }, [dayTs]);

  const cajaInicial = cierre?.cajaInicial ?? 0;

  // ¿El que mira es superadmin? Si sí, no aplicamos los toggles
  const isSuperadmin = user?.role === "superadmin";
  const showGanancia = isSuperadmin || config.mostrarGananciaASocios;
  const showGastos = isSuperadmin || config.mostrarGastosASocios;
  const showCajaFisica = isSuperadmin || config.mostrarCajaFisicaASocios;

  // ESC cierra + bloquear scroll
  useEffect(() => {
    if (dayTs === null) return;
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", fn);
      document.body.style.overflow = "";
    };
  }, [dayTs, onClose]);

  // Cargar gastos del día al abrir — con guard isMounted contra race conditions
  // si el user cambia rápido de un día a otro.
  useEffect(() => {
    if (dayTs === null) return;
    let alive = true;
    const { start, end } = dayBounds(dayTs);
    setLoadingExp(true);
    getExpensesForDay(start, end)
      .then((exp) => {
        if (alive) setExpenses(exp);
      })
      .catch(() => {
        if (alive) setExpenses([]);
      })
      .finally(() => {
        if (alive) setLoadingExp(false);
      });
    return () => {
      alive = false;
    };
  }, [dayTs]);

  const data = useMemo(() => {
    if (dayTs === null) return null;
    const { start, end, date } = dayBounds(dayTs);
    const truck = findTruckForDay(trucks, start);

    // La VENTA del día = remitos no anulados (fuente única de verdad)
    const dayRemitos = remitos.filter(
      (r) => r.fecha >= start && r.fecha <= end && !r.anulado
    );
    const ventaRemitos = dayRemitos.reduce((s, r) => s + r.total, 0);
    const costoRemitos = dayRemitos.reduce(
      (s, r) =>
        s + r.items.reduce((a, it) => a + it.cantidad * it.costoUnitario, 0),
      0
    );
    const gananciaRemitos = ventaRemitos - costoRemitos;

    // Detalle de productos vendidos (agrupado) desde los remitos
    const itemsMap = new Map<
      string,
      { productId: string; nombre: string; cantidad: number; total: number }
    >();
    dayRemitos.forEach((r) =>
      r.items.forEach((it) => {
        const cur = itemsMap.get(it.productId);
        if (cur) {
          cur.cantidad += it.cantidad;
          cur.total += it.cantidad * it.precioVenta;
        } else {
          itemsMap.set(it.productId, {
            productId: it.productId,
            nombre: it.nombre,
            cantidad: it.cantidad,
            total: it.cantidad * it.precioVenta,
          });
        }
      })
    );

    /*
     * STOCK DEL DÍA: inicial → vendido → final, para poder controlar.
     *
     * El stock guardado en el producto es el de AHORA, así que para un día
     * pasado hay que "rebobinar": deshacer las ventas y las recepciones
     * POSTERIORES a ese día. Después, el inicial sale del final del día.
     *
     *   final del día = stock de hoy + vendido después − recibido después
     *   inicial       = final del día + vendido ese día − recibido ese día
     *
     * Ojo: solo contempla ventas (remitos) y recepciones de camión. Si alguien
     * corrige el stock a mano desde Productos, ese ajuste no se ve acá.
     */
    const vendidoDespues = new Map<string, number>();
    remitos
      .filter((r) => r.fecha > end && !r.anulado)
      .forEach((r) =>
        r.items.forEach((it) =>
          vendidoDespues.set(
            it.productId,
            (vendidoDespues.get(it.productId) ?? 0) + it.cantidad
          )
        )
      );

    const recibidoEnElDia = new Map<string, number>();
    const recibidoDespues = new Map<string, number>();
    trucks.forEach((t) => {
      const destino =
        t.fechaIngreso >= start && t.fechaIngreso <= end
          ? recibidoEnElDia
          : t.fechaIngreso > end
          ? recibidoDespues
          : null;
      if (!destino) return;
      (t.carga ?? []).forEach((c) =>
        destino.set(
          c.productId,
          (destino.get(c.productId) ?? 0) + c.cantidadUnidades
        )
      );
    });

    const items = Array.from(itemsMap.values())
      .map((it) => {
        const stockHoy = productos.find((p) => p.id === it.productId)?.stock ?? 0;
        const stockFinal =
          stockHoy +
          (vendidoDespues.get(it.productId) ?? 0) -
          (recibidoDespues.get(it.productId) ?? 0);
        const recibido = recibidoEnElDia.get(it.productId) ?? 0;
        return {
          ...it,
          recibido,
          stockFinal,
          stockInicial: stockFinal + it.cantidad - recibido,
        };
      })
      .sort((a, b) => b.cantidad - a.cantidad);

    // Gastos por tipo + por forma de pago
    const gastosPorTipo: Record<string, number> = {};
    let gastosEfectivo = 0;
    expenses.forEach((g) => {
      gastosPorTipo[g.tipo] = (gastosPorTipo[g.tipo] ?? 0) + g.monto;
      if (g.formaPago === "efectivo") gastosEfectivo += g.monto;
    });
    const totalGastos = expenses.reduce((s, g) => s + g.monto, 0);

    // === Caja Fidel del día (sobre las ventas = remitos) ===
    // Desglose por forma de pago (remitos viejos sin forma = efectivo).
    const ventaEfectivo = dayRemitos
      .filter((r) => (r.formaPago ?? "efectivo") === "efectivo")
      .reduce((s, r) => s + r.total, 0);
    const ventaTransferencia = dayRemitos
      .filter((r) => r.formaPago === "transferencia")
      .reduce((s, r) => s + r.total, 0);
    const ventaCheque = dayRemitos
      .filter((r) => r.formaPago === "cheque")
      .reduce((s, r) => s + r.total, 0);
    // Caja Fidel = total vendido; la caja física solo cuenta el EFECTIVO.
    const cajaFidel = ventaRemitos;
    // MISMA fórmula que el cierre en Ventas → Caja (incluye los pagos a
    // proveedores hechos con billetes y no tapa los negativos con un max(0)).
    const cajaFisica = efectivoEsperadoDelDia({
      cajaInicial,
      ventaEfectivo,
      gastos: expenses,
      pagos,
    });
    const pagosEfectivo =
      cajaInicial + ventaEfectivo - gastosEfectivo - cajaFisica;
    const gananciaEstimada =
      truck && truck.porcentajeGanancia
        ? (ventaRemitos * truck.porcentajeGanancia) / 100
        : 0;

    const totalUnidades = items.reduce((s, it) => s + it.cantidad, 0);

    return {
      truck,
      items,
      totalUnidades,
      date,
      expenses,
      totalGastos,
      gastosPorTipo,
      gastosEfectivo,
      pagosEfectivo,
      cajaFidel,
      cajaFisica,
      gananciaEstimada,
      dayRemitos,
      ventaRemitos,
      costoRemitos,
      gananciaRemitos,
      ventaEfectivo,
      ventaTransferencia,
      ventaCheque,
    };
  }, [dayTs, trucks, expenses, remitos, cajaInicial, pagos, productos]);

  if (dayTs === null || !data) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/50 backdrop-blur-sm sm:place-items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banda superior con color del camión */}
        <div
          className="h-3 w-full"
          style={{ background: data.truck?.color ?? "#94a3b8" }}
        />
        <div className="p-5 sm:p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-brand-dark/50">
                Reporte del día
              </p>
              <h2 className="font-serif text-2xl text-brand-dark first-letter:uppercase">
                {FULL_DATE(data.date)}
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              ✕
            </button>
          </div>

          {/* Camión */}
          <section className="mt-4 rounded-xl border border-brand-border bg-primary-light/40 p-4">
            {data.truck ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-12 w-12 place-items-center rounded-full text-xl text-white shadow"
                    style={{ background: data.truck.color }}
                  >
                    🚚
                  </span>
                  <div>
                    <p className="text-xs uppercase text-brand-dark/55">
                      Camión activo
                    </p>
                    <p className="font-serif text-lg font-medium text-brand-dark">
                      {data.truck.nombre}
                    </p>
                  </div>
                </div>
                {showGanancia && (
                  <div className="text-right">
                    <p className="text-xs uppercase text-brand-dark/55">
                      % Ganancia
                    </p>
                    <p className="font-serif text-2xl text-primary">
                      {data.truck.porcentajeGanancia}%
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-brand-dark/55">
                No había camión activo este día.
              </p>
            )}
          </section>

          {/* Ventas */}
          <section className="mt-4">
            <h3 className="mb-2 font-serif text-lg text-brand-dark">
              Ventas del día
            </h3>
            {data.dayRemitos.length === 0 ? (
              <p className="rounded-lg border border-brand-border bg-slate-50 p-3 text-sm text-brand-dark/55">
                No hubo ventas (remitos) registradas este día.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border border-brand-border bg-surface">
                  <table className="w-full text-sm">
                    <thead className="bg-primary-light/40 text-xs uppercase text-primary">
                      <tr>
                        <th className="px-3 py-2 text-left">Producto</th>
                        <th className="px-3 py-2 text-right" title="Unidades que había al empezar el día">
                          St. inicial
                        </th>
                        <th className="px-3 py-2 text-right">Vend.</th>
                        <th className="px-3 py-2 text-right" title="Unidades que quedaron al terminar el día">
                          St. final
                        </th>
                        <th className="px-3 py-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((it, i) => (
                        <tr
                          key={i}
                          className="border-t border-brand-border first:border-t-0"
                        >
                          <td className="px-3 py-2">
                            {it.nombre}
                            {it.recibido > 0 && (
                              <span
                                className="ml-1.5 rounded bg-sky-100 px-1 text-[10px] font-bold text-sky-800"
                                title="Entraron por camión ese día"
                              >
                                +{it.recibido} camión
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-brand-dark/60">
                            {it.stockInicial}
                          </td>
                          <td className="px-3 py-2 text-right font-bold tabular-nums">
                            {it.cantidad}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-semibold tabular-nums ${
                              it.stockFinal === 0
                                ? "text-rose-700"
                                : "text-brand-dark/60"
                            }`}
                          >
                            {it.stockFinal}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {it.total > 0 ? formatARS(it.total) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-brand-border bg-primary-light/30 font-bold">
                        <td className="px-3 py-2">Total</td>
                        <td />
                        <td className="px-3 py-2 text-right tabular-nums">
                          {data.totalUnidades} u.
                        </td>
                        <td />
                        <td className="px-3 py-2 text-right">
                          {formatARS(data.ventaRemitos)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="mt-1 text-[10px] text-brand-dark/45">
                  Stock inicial = stock final + vendido − lo que entró por camión
                  ese día. No contempla correcciones de stock hechas a mano desde
                  Productos.
                </p>
                <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
                  <span className="text-sm font-medium text-emerald-900">
                    Total ventas (Caja Fidel)
                  </span>
                  <span className="text-lg font-bold text-emerald-900">
                    {data.cajaFidel > 0
                      ? formatARS(data.cajaFidel)
                      : "a confirmar"}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-brand-dark/45">
                  {data.dayRemitos.length} venta
                  {data.dayRemitos.length === 1 ? "" : "s"} (remito
                  {data.dayRemitos.length === 1 ? "" : "s"}) ·{" "}
                  <b>{data.totalUnidades} unidades</b> vendidas en el día
                </p>
              </>
            )}
          </section>

          {/* Gastos */}
          {showGastos && (
          <section className="mt-4">
            <h3 className="mb-2 font-serif text-lg text-brand-dark">
              Gastos del día
            </h3>
            {loadingExp ? (
              <p className="text-sm text-brand-dark/55">Cargando…</p>
            ) : (
              <>
                <div className="grid gap-1 rounded-xl border border-brand-border bg-surface p-3 text-sm">
                  {EXPENSE_TYPES.map((t) => {
                    const monto = data.gastosPorTipo[t] ?? 0;
                    return (
                      <div
                        key={t}
                        className="flex items-center justify-between border-b border-brand-border/40 py-1.5 last:border-b-0"
                      >
                        <span className="text-brand-dark/75">
                          {EXPENSE_LABELS[t]}
                        </span>
                        <span
                          className={
                            monto > 0 ? "font-semibold text-rose-700" : "text-brand-dark/35"
                          }
                        >
                          {monto > 0 ? `-${formatARS(monto)}` : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex items-center justify-between rounded-lg bg-rose-50 px-3 py-2">
                  <span className="text-sm font-medium text-rose-900">
                    Total gastos del día
                  </span>
                  <span className="text-lg font-bold text-rose-900">
                    {data.totalGastos > 0
                      ? `-${formatARS(data.totalGastos)}`
                      : "—"}
                  </span>
                </div>
              </>
            )}
          </section>
          )}

          {/* Ganancia del día — desde los remitos (venta − costo) */}
          {showGanancia && (
            <section className="mt-4">
              <h3 className="mb-2 font-serif text-lg text-brand-dark">
                💰 Ganancia del día
              </h3>
              {data.dayRemitos.length === 0 ? (
                <p className="rounded-lg border border-brand-border bg-slate-50 p-3 text-sm text-brand-dark/55">
                  No hubo ventas (remitos) este día.
                </p>
              ) : (
                <>
                  <div className="overflow-hidden rounded-xl border border-brand-border bg-surface">
                    <table className="w-full text-sm">
                      <thead className="bg-primary-light/40 text-[11px] uppercase text-primary">
                        <tr>
                          <th className="px-3 py-2 text-left">Venta</th>
                          <th className="px-3 py-2 text-right">Importe</th>
                          <th className="px-3 py-2 text-right">Costo</th>
                          <th className="px-3 py-2 text-right">Ganancia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.dayRemitos.map((r) => {
                          const costo = r.items.reduce(
                            (a, it) => a + it.cantidad * it.costoUnitario,
                            0
                          );
                          return (
                            <tr
                              key={r.id}
                              className="border-t border-brand-border first:border-t-0"
                            >
                              <td className="px-3 py-2">
                                {r.numero}
                                {r.clienteNombre ? ` · ${r.clienteNombre}` : ""}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {formatARS(r.total)}
                              </td>
                              <td className="px-3 py-2 text-right text-rose-700">
                                {formatARS(costo)}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                                {formatARS(r.total - costo)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
                    <span className="text-sm font-medium text-emerald-900">
                      Ganancia total del día
                    </span>
                    <span className="text-lg font-bold text-emerald-900">
                      {formatARS(data.gananciaRemitos)}
                    </span>
                  </div>
                </>
              )}
            </section>
          )}

          {/* Cierre de caja — resumen de solo lectura (el cierre se hace en Caja) */}
          {showCajaFisica && (
          <section className="mt-4 rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary-light/40 to-surface p-4">
            <h3 className="mb-3 flex items-center gap-2 font-serif text-lg text-primary">
              🏦 Cierre de caja
              {cierre?.cerrado && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                  Cerrada
                </span>
              )}
            </h3>
            <div className="space-y-1.5 text-sm">
              <Row label="Caja inicial del día" value={cajaInicial} />
              <Row label="Ventas del día" value={data.cajaFidel} tone="emerald" />
              {data.ventaEfectivo > 0 && (
                <Row label="• Efectivo" value={data.ventaEfectivo} />
              )}
              {data.ventaTransferencia > 0 && (
                <Row label="• Transferencia (banco)" value={data.ventaTransferencia} />
              )}
              {data.ventaCheque > 0 && (
                <Row label="• Cheque (a cobrar)" value={data.ventaCheque} />
              )}
              <Row label="Gastos en efectivo" value={-data.gastosEfectivo} tone="rose" />
              {data.pagosEfectivo > 0 && (
                <Row
                  label="Pagos a proveedores (billetes)"
                  value={-data.pagosEfectivo}
                  tone="rose"
                />
              )}
              <div className="my-1 h-px bg-brand-border" />
              <Row label="Efectivo esperado en caja" value={data.cajaFisica} bold />
              {cierre?.cerrado && (
                <>
                  <Row
                    label="Efectivo contado (arqueo)"
                    value={cierre.efectivoContado ?? 0}
                    bold
                  />
                  <Row
                    label="Diferencia"
                    value={cierre.diferencia ?? 0}
                    bold
                    tone={
                      (cierre.diferencia ?? 0) === 0
                        ? undefined
                        : (cierre.diferencia ?? 0) > 0
                        ? "emerald"
                        : "rose"
                    }
                  />
                </>
              )}
            </div>
            <p className="mt-3 text-[10px] text-brand-dark/45">
              {cierre?.cerrado ? "Caja cerrada. " : "Caja abierta. "}
              El cierre con arqueo (contar billetes) se hace en{" "}
              <b>Ventas → Caja</b>.
            </p>
          </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: number;
  bold?: boolean;
  tone?: "emerald" | "rose" | "primary";
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "rose"
      ? "text-rose-700"
      : tone === "primary"
      ? "text-primary"
      : "text-brand-dark";
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-medium text-brand-dark" : "text-brand-dark/70"}>
        {label}
      </span>
      <span className={`${bold ? "font-bold" : "font-medium"} ${color}`}>
        {value === 0
          ? "—"
          : value < 0
          ? `-${formatARS(Math.abs(value))}`
          : formatARS(value)}
      </span>
    </div>
  );
}