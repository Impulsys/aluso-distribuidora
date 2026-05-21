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
import {
  dayKey,
  setCashInitial,
  subscribeCashInitialRange,
} from "@/lib/cash-initial";
import {
  EXPENSE_LABELS,
  type DailyExpense,
  type ExpenseType,
  type Order,
  type Truck,
} from "@/lib/types";

interface Props {
  dayTs: number | null; // EOD del día seleccionado (null = cerrado)
  onClose: () => void;
  orders: Order[];
  trucks: Truck[];
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
  orders,
  trucks,
}: Props) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [loadingExp, setLoadingExp] = useState(false);
  const [config, setConfig] = useState<ReportesConfig>(DEFAULT_REPORTES_CONFIG);
  const [cajaInicial, setCajaInicialState] = useState(0);
  const [editingCaja, setEditingCaja] = useState(false);
  const [cajaInput, setCajaInput] = useState("");

  useEffect(() => {
    const unsub = subscribeReportesConfig(setConfig);
    return unsub;
  }, []);

  // Subscribirse a la caja inicial del día
  useEffect(() => {
    if (dayTs === null) return;
    const d = new Date(dayTs);
    d.setHours(0, 0, 0, 0);
    const start = d.getTime();
    const end = start + 86_400_000;
    const unsub = subscribeCashInitialRange(start, end, (map) => {
      const k = dayKey(dayTs);
      const v = map[k] ?? 0;
      setCajaInicialState(v);
      if (!editingCaja) setCajaInput(String(v));
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayTs]);

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
    const dayOrders = orders.filter(
      (o) =>
        o.createdAt >= start &&
        o.createdAt <= end &&
        o.status !== "cancelado"
    );
    const totalVentas = dayOrders.reduce((s, o) => s + (o.total || 0), 0);
    // Ingresos cobrados en efectivo del día (usamos formaPago si vino,
    // si no asumimos efectivo por defecto)
    const ingresosEfectivo = dayOrders.reduce((s, o) => {
      const fp = o.formaPago ?? "efectivo";
      return fp === "efectivo" ? s + (o.total || 0) : s;
    }, 0);
    const itemsMap = new Map<
      string,
      { nombre: string; cantidad: number; total: number }
    >();
    dayOrders.forEach((o) =>
      o.items.forEach((it) => {
        const cur = itemsMap.get(it.productId);
        if (cur) {
          cur.cantidad += it.cantidad;
          cur.total += it.cantidad * it.precioVenta;
        } else {
          itemsMap.set(it.productId, {
            nombre: it.nombre,
            cantidad: it.cantidad,
            total: it.cantidad * it.precioVenta,
          });
        }
      })
    );
    const items = Array.from(itemsMap.values()).sort(
      (a, b) => b.cantidad - a.cantidad
    );

    // Gastos por tipo + por forma de pago
    const gastosPorTipo: Record<string, number> = {};
    let gastosEfectivo = 0;
    expenses.forEach((g) => {
      gastosPorTipo[g.tipo] = (gastosPorTipo[g.tipo] ?? 0) + g.monto;
      if (g.formaPago === "efectivo") gastosEfectivo += g.monto;
    });
    const totalGastos = expenses.reduce((s, g) => s + g.monto, 0);

    // === Caja Fidel del día ===
    // Definición del cliente (confirmada):
    //  - Caja Fidel = total ingresos / ventas del día
    //  - Caja física = efectivo que queda = ingresos en efectivo - gastos en efectivo
    //  - Banco = Caja Fidel - Caja física (lo restante se deposita)
    // Como hoy todavía no capturamos formaPago en cada venta, asumimos
    // 100% en efectivo para el cálculo de la caja física (estimado).
    const cajaFidel = totalVentas;
    // Caja física = efectivo que va quedando en mano
    // = caja inicial + ingresos en efectivo del día − gastos pagados en efectivo
    const cajaFisica = Math.max(
      0,
      cajaInicial + ingresosEfectivo - gastosEfectivo
    );
    // A depositar = caja física − caja inicial (lo que sobra del día sobre el efectivo de arranque)
    const banco = Math.max(0, cajaFisica - cajaInicial);
    const gananciaEstimada =
      truck && truck.porcentajeGanancia
        ? (totalVentas * truck.porcentajeGanancia) / 100
        : 0;

    return {
      truck,
      dayOrders,
      totalVentas,
      items,
      date,
      expenses,
      totalGastos,
      gastosPorTipo,
      gastosEfectivo,
      cajaFidel,
      cajaFisica,
      banco,
      gananciaEstimada,
    };
  }, [dayTs, orders, trucks, expenses]);

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
            {data.dayOrders.length === 0 ? (
              <p className="rounded-lg border border-brand-border bg-slate-50 p-3 text-sm text-brand-dark/55">
                No hubo movimientos de venta registrados.
              </p>
            ) : (
              <>
                <div className="rounded-xl border border-brand-border bg-surface">
                  <table className="w-full text-sm">
                    <thead className="bg-primary-light/40 text-xs uppercase text-primary">
                      <tr>
                        <th className="px-3 py-2 text-left">Producto</th>
                        <th className="px-3 py-2 text-right">Cant.</th>
                        <th className="px-3 py-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((it, i) => (
                        <tr
                          key={i}
                          className="border-t border-brand-border first:border-t-0"
                        >
                          <td className="px-3 py-2">{it.nombre}</td>
                          <td className="px-3 py-2 text-right font-medium">
                            {it.cantidad}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {it.total > 0 ? formatARS(it.total) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                  {data.dayOrders.length} pedido
                  {data.dayOrders.length === 1 ? "" : "s"} registrado
                  {data.dayOrders.length === 1 ? "" : "s"} en la plataforma
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

          {/* Caja Fidel — cierre del día */}
          {showCajaFisica && (
          <section className="mt-4 rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary-light/40 to-surface p-4">
            <h3 className="mb-3 flex items-center gap-2 font-serif text-lg text-primary">
              🏦 Cierre Caja Fidel
            </h3>
            <div className="space-y-1.5 text-sm">
              {/* Caja inicial editable por superadmin, readonly para socio */}
              {isSuperadmin ? (
                <div className="flex items-center justify-between">
                  <span className="text-brand-dark/70">Caja inicial del día</span>
                  <div className="flex items-center gap-1">
                    <span className="text-brand-dark/50">$</span>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={editingCaja ? cajaInput : cajaInicial || ""}
                      onFocus={() => {
                        setEditingCaja(true);
                        setCajaInput(String(cajaInicial || ""));
                      }}
                      onChange={(e) => setCajaInput(e.target.value)}
                      onBlur={async () => {
                        const v = Number(cajaInput) || 0;
                        if (v !== cajaInicial) {
                          await setCashInitial(dayTs, v, user?.uid);
                        }
                        setEditingCaja(false);
                      }}
                      placeholder="0"
                      className="w-28 rounded-md border border-brand-border bg-white px-2 py-1 text-right text-sm focus:border-primary outline-none"
                    />
                  </div>
                </div>
              ) : (
                <Row label="Caja inicial del día" value={cajaInicial} />
              )}
              <Row label="Caja Fidel (ingresos)" value={data.cajaFidel} tone="emerald" />
              <Row label="Gastos en efectivo" value={-data.gastosEfectivo} tone="rose" />
              <div className="my-1 h-px bg-brand-border" />
              <Row label="Caja física (efectivo en mano)" value={data.cajaFisica} bold />
              <Row label="A depositar en banco" value={data.banco} bold tone="primary" />
              {data.gananciaEstimada > 0 && (
                <Row
                  label={`Ganancia estimada (${data.truck?.porcentajeGanancia}%)`}
                  value={data.gananciaEstimada}
                  tone="emerald"
                  bold
                />
              )}
            </div>
            <p className="mt-3 text-[10px] text-brand-dark/45">
              * Caja física calculada con las ventas marcadas como efectivo
              menos los gastos en efectivo del día.
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