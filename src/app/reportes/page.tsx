"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { subscribeTrucks } from "@/lib/trucks";
import { useAuth } from "@/context/AuthContext";
import {
  DEFAULT_REPORTES_CONFIG,
  subscribeReportesConfig,
  type ReportesConfig,
} from "@/lib/config";
import {
  subscribePurchases,
  subscribeSupplierPayments,
  deudaGlobal,
} from "@/lib/cuentas";
import MonthCalendar from "@/components/MonthCalendar";
import DayReportModal from "@/components/DayReportModal";
import { formatARS } from "@/lib/format";
import type {
  DailyExpense,
  Order,
  Purchase,
  SupplierPayment,
  Truck,
} from "@/lib/types";

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export default function ReportesPage() {
  const { user } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [config, setConfig] = useState<ReportesConfig>(DEFAULT_REPORTES_CONFIG);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dayOpen, setDayOpen] = useState<number | null>(null);

  // Suscripciones tiempo real
  useEffect(() => {
    const u1 = subscribeTrucks(setTrucks);
    const u2 = subscribeReportesConfig(setConfig);
    const u3 = subscribePurchases(setPurchases);
    const u4 = subscribeSupplierPayments(setSupplierPayments);
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, []);

  const deudaProveedores = deudaGlobal(purchases, supplierPayments);

  // Fetch pedidos + gastos del año
  useEffect(() => {
    const startTs = new Date(year, 0, 1).getTime();
    const endTs = new Date(year + 1, 0, 1).getTime();
    setLoading(true);
    Promise.all([
      getDocs(
        query(
          collection(db, "orders"),
          where("createdAt", ">=", startTs),
          where("createdAt", "<", endTs)
        )
      ),
      getDocs(
        query(
          collection(db, "expenses"),
          where("fecha", ">=", startTs),
          where("fecha", "<", endTs)
        )
      ),
    ])
      .then(([oSnap, eSnap]) => {
        setOrders(
          oSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Order))
        );
        setExpenses(
          eSnap.docs.map(
            (d) => ({ id: d.id, ...d.data() } as DailyExpense)
          )
        );
        setError(null);
      })
      .catch((e) => {
        console.error(e);
        setError("No se pudieron cargar los datos del año.");
      })
      .finally(() => setLoading(false));
  }, [year]);

  // Camiones que tocan el año (para la leyenda)
  const trucksConRangos = useMemo(() => {
    const yearStart = new Date(year, 0, 1).getTime();
    const yearEnd = new Date(year + 1, 0, 1).getTime();
    return trucks.filter(
      (t) =>
        t.fechaIngreso < yearEnd &&
        (!t.fechaCierre || t.fechaCierre > yearStart)
    );
  }, [trucks, year]);

  // ====== TOTALES — año completo + mes actual ======
  const totales = useMemo(() => {
    const ventas = orders
      .filter((o) => o.status !== "cancelado")
      .reduce((s, o) => s + (o.total || 0), 0);
    const gastos = expenses.reduce((s, e) => s + (e.monto || 0), 0);
    const margen = ventas - gastos;

    // Mes actual (si estamos viendo el año actual; sino, último mes con datos)
    const now = new Date();
    const isCurrentYear = year === now.getFullYear();
    const mes = isCurrentYear ? now.getMonth() : 11;
    const mStart = new Date(year, mes, 1).getTime();
    const mEnd = new Date(year, mes + 1, 1).getTime();
    const ventasMes = orders
      .filter(
        (o) =>
          o.status !== "cancelado" &&
          o.createdAt >= mStart &&
          o.createdAt < mEnd
      )
      .reduce((s, o) => s + (o.total || 0), 0);
    const gastosMes = expenses
      .filter((e) => e.fecha >= mStart && e.fecha < mEnd)
      .reduce((s, e) => s + (e.monto || 0), 0);
    const margenMes = ventasMes - gastosMes;
    return { ventas, gastos, margen, ventasMes, gastosMes, margenMes, mes };
  }, [orders, expenses, year]);

  // Respeta config para socios: ocultar gastos/margen si superadmin lo bloqueó
  const isSuperadmin = user?.role === "superadmin";
  const showGastos = isSuperadmin || config.mostrarGastosASocios;

  return (
    <div>
      <p className="mb-4 text-sm text-brand-dark/65">
        Movimientos de venta por día. Tocá cualquier día para ver el detalle.
      </p>

      {/* ============ TOTALES DEL AÑO + DEL MES ============ */}
      {!loading && (
        <section className="mb-6">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="font-serif text-xl text-brand-dark">
              Totales {year}
            </h2>
            <span className="text-xs text-brand-dark/55">
              {orders.filter((o) => o.status !== "cancelado").length} pedidos ·{" "}
              {expenses.length} gastos
            </span>
          </div>
          <div
            className={`grid gap-3 ${
              showGastos ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1"
            }`}
          >
            <KpiCard
              label="Ventas del año"
              value={totales.ventas}
              hint={`Mes en curso (${MONTH_NAMES[totales.mes]}): ${formatARS(
                totales.ventasMes
              )}`}
              tone="emerald"
            />
            {showGastos && (
              <KpiCard
                label="Gastos del año"
                value={totales.gastos}
                hint={`Mes en curso: ${formatARS(totales.gastosMes)}`}
                tone="rose"
                isNegative
              />
            )}
            {showGastos && (
              <KpiCard
                label="Margen del año"
                value={totales.margen}
                hint={`Mes en curso: ${formatARS(totales.margenMes)}`}
                tone={totales.margen >= 0 ? "primary" : "rose"}
              />
            )}
          </div>
        </section>
      )}

      {/* Deuda a proveedores (cuentas corrientes) */}
      <section className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-rose-200 bg-gradient-to-br from-rose-50 to-surface p-5 shadow-sm">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-brand-dark/55">
              Deuda a proveedores
            </p>
            <p className="mt-1 font-serif text-3xl font-medium text-rose-700">
              {deudaProveedores > 0 ? formatARS(deudaProveedores) : "Al día"}
            </p>
          </div>
          <Link
            href="/reportes/cuentas"
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-primary-dark"
          >
            Ver cuentas corrientes →
          </Link>
        </div>
      </section>

      {/* Navegación de año + leyenda */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-1 rounded-full border border-brand-border bg-surface p-1">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-primary-light"
            aria-label="Año anterior"
          >
            ←
          </button>
          <span className="px-3 font-serif text-xl font-medium text-brand-dark">
            {year}
          </span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-primary-light"
            aria-label="Año siguiente"
          >
            →
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <Legend swatch="bg-emerald-300" label="Con ventas" />
          <Legend swatch="bg-rose-300" label="Sin ventas" />
          <Legend swatch="bg-slate-200" label="Futuro" />
        </div>
      </div>

      {/* Camiones del año (leyenda visual) */}
      {trucksConRangos.length > 0 && (
        <div className="mb-5 rounded-xl border border-brand-border bg-surface p-3">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-brand-dark/55">
            Camiones del {year}
          </p>
          <div className="flex flex-wrap gap-2">
            {trucksConRangos.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-brand-dark"
              >
                <span
                  className="h-3 w-3 rounded-sm"
                  style={{ background: t.color }}
                />
                {t.nombre}
                {!t.fechaCierre && (
                  <span className="rounded-full bg-emerald-100 px-1.5 text-[9px] font-bold uppercase text-emerald-800">
                    activo
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <p className="py-12 text-center text-brand-dark/60">
          Cargando calendario…
        </p>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
          {error}
        </div>
      )}

      {!loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 12 }).map((_, m) => (
            <MonthCalendar
              key={m}
              year={year}
              month={m}
              trucks={trucks}
              orders={orders}
              onDayClick={(ts) => setDayOpen(ts)}
            />
          ))}
        </div>
      )}

      <DayReportModal
        dayTs={dayOpen}
        onClose={() => setDayOpen(null)}
        orders={orders}
        trucks={trucks}
      />
    </div>
  );
}

// ====================
function KpiCard({
  label,
  value,
  hint,
  tone,
  isNegative,
}: {
  label: string;
  value: number;
  hint?: string;
  tone: "emerald" | "rose" | "primary";
  isNegative?: boolean;
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "rose"
      ? "text-rose-700"
      : "text-primary";
  const bg =
    tone === "emerald"
      ? "from-emerald-50"
      : tone === "rose"
      ? "from-rose-50"
      : "from-primary-light";

  return (
    <article
      className={`rounded-2xl border border-brand-border bg-gradient-to-br ${bg} to-surface p-5 shadow-sm`}
    >
      <p className="text-[11px] uppercase tracking-wider text-brand-dark/55">
        {label}
      </p>
      <p className={`mt-2 font-serif text-3xl font-medium leading-tight ${color}`}>
        {value === 0
          ? "—"
          : isNegative
          ? `-${formatARS(Math.abs(value))}`
          : formatARS(value)}
      </p>
      {hint && (
        <p className="mt-2 text-[11px] text-brand-dark/55">{hint}</p>
      )}
    </article>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-brand-dark/65">
      <span className={`h-3 w-3 rounded ${swatch}`} />
      {label}
    </span>
  );
}
