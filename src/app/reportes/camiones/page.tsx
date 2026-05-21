"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { subscribeTrucks } from "@/lib/trucks";
import { formatARS, formatDate, daysBetween } from "@/lib/format";
import type { DailyExpense, Order, Truck } from "@/lib/types";

export default function ReportesCamionesPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeTrucks(setTrucks);
    return unsub;
  }, []);

  useEffect(() => {
    // Traemos un rango amplio: año anterior (algunos camiones cruzan año)
    const startTs = new Date(year - 1, 0, 1).getTime();
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

  // Camiones cuyo rango toca el año
  const trucksAnio = useMemo(() => {
    const yearStart = new Date(year, 0, 1).getTime();
    const yearEnd = new Date(year + 1, 0, 1).getTime();
    return trucks.filter(
      (t) =>
        t.fechaIngreso < yearEnd && (!t.fechaCierre || t.fechaCierre > yearStart)
    );
  }, [trucks, year]);

  // Por cada camión: KPIs
  const reports = useMemo(
    () =>
      trucksAnio.map((t) => {
        const start = t.fechaIngreso;
        const end = t.fechaCierre ?? Date.now();
        const orderMatches = orders.filter(
          (o) =>
            o.status !== "cancelado" &&
            // Por truckId si fue asignado en la creación; si no, por rango
            (o.truckId === t.id ||
              (!o.truckId && o.createdAt >= start && o.createdAt <= end))
        );
        const expenseMatches = expenses.filter(
          (e) => e.fecha >= start && e.fecha <= end
        );
        const totalVentas = orderMatches.reduce(
          (s, o) => s + (o.total || 0),
          0
        );
        const totalGastos = expenseMatches.reduce((s, e) => s + e.monto, 0);
        const costo = t.costoCamion ?? 0;
        const dias = daysBetween(start, end);
        const gananciaEstimada = (costo * (t.porcentajeGanancia ?? 0)) / 100;
        const gananciaReal = totalVentas - costo - totalGastos;
        const unidadesCargadas = (t.carga ?? []).reduce(
          (s, it) => s + it.cantidadUnidades,
          0
        );
        return {
          truck: t,
          totalVentas,
          totalGastos,
          orderCount: orderMatches.length,
          dias,
          gananciaEstimada,
          gananciaReal,
          unidadesCargadas,
          activo: !t.fechaCierre,
        };
      }),
    [trucksAnio, orders, expenses]
  );

  return (
    <div>
      {/* Año */}
      <div className="mb-5 flex items-center justify-between">
        <div className="inline-flex items-center gap-1 rounded-full border border-brand-border bg-surface p-1">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-primary-light"
          >
            ←
          </button>
          <span className="px-3 font-serif text-xl font-medium text-brand-dark">
            {year}
          </span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-primary-light"
          >
            →
          </button>
        </div>
        <span className="text-sm text-brand-dark/65">
          {trucksAnio.length} camión
          {trucksAnio.length === 1 ? "" : "es"} en el año
        </span>
      </div>

      {loading && (
        <p className="py-12 text-center text-brand-dark/60">Cargando…</p>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
          {error}
        </div>
      )}

      {!loading && reports.length === 0 && (
        <div className="rounded-2xl border border-brand-border bg-surface p-10 text-center text-brand-dark/65">
          No hay camiones registrados en {year}.
        </div>
      )}

      <div className="space-y-4">
        {reports.map((r) => (
          <TruckReportCard key={r.truck.id} r={r} />
        ))}
      </div>
    </div>
  );
}

// ===================
function TruckReportCard({
  r,
}: {
  r: {
    truck: Truck;
    totalVentas: number;
    totalGastos: number;
    orderCount: number;
    dias: number;
    gananciaEstimada: number;
    gananciaReal: number;
    unidadesCargadas: number;
    activo: boolean;
  };
}) {
  const { truck: t } = r;
  const proveedor =
    t.proveedor === "otro" ? t.proveedorOtro || "(sin nombre)" : t.proveedor;
  const transporte =
    t.transporte === "otro" ? t.transporteOtro || "(sin nombre)" : t.transporte;

  return (
    <article className="overflow-hidden rounded-2xl border border-brand-border bg-surface shadow-sm">
      {/* Banda color */}
      <div className="h-2 w-full" style={{ background: t.color }} />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="flex items-start gap-3">
          <div
            className="grid h-12 w-12 place-items-center rounded-full text-2xl text-white shadow"
            style={{ background: t.color }}
          >
            🚚
          </div>
          <div>
            <h3 className="font-serif text-xl text-brand-dark">
              {t.nombre}
              {r.activo && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 align-middle text-[10px] font-bold uppercase text-emerald-800">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Activo
                </span>
              )}
            </h3>
            <p className="text-xs text-brand-dark/55">
              📅 {formatDate(t.fechaIngreso)}
              {t.fechaCierre ? <> → {formatDate(t.fechaCierre)}</> : <> → en curso</>}
              {" · "}
              📋 {proveedor || "—"}
              {" · "}
              🚛 {transporte || "—"}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-brand-dark/55">
            % Ganancia asignada
          </p>
          <p className="font-serif text-2xl text-primary">
            {t.porcentajeGanancia ?? 0}%
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-px bg-brand-border sm:grid-cols-4">
        <Kpi
          label="Días operando"
          value={`${r.dias} d`}
          hint={r.activo ? "hasta hoy" : "total cerrado"}
        />
        <Kpi
          label="Pedidos"
          value={r.orderCount}
          hint={`${r.unidadesCargadas} u. cargadas`}
        />
        <Kpi
          label="Ventas totales"
          value={r.totalVentas > 0 ? formatARS(r.totalVentas) : "—"}
          hint="suma pedidos"
          tone="emerald"
        />
        <Kpi
          label="Gastos imputados"
          value={r.totalGastos > 0 ? formatARS(r.totalGastos) : "—"}
          hint="dentro del rango"
          tone="rose"
        />
      </div>

      {/* Económico */}
      <div className="grid grid-cols-1 gap-px bg-brand-border sm:grid-cols-3">
        {t.costoCamion !== undefined && (
          <Kpi
            label="Costo del camión"
            value={t.costoCamion > 0 ? formatARS(t.costoCamion) : "—"}
            hint="cuánto salió"
            tone="dark"
          />
        )}
        <Kpi
          label="Ganancia estimada"
          value={
            r.gananciaEstimada > 0 ? formatARS(r.gananciaEstimada) : "—"
          }
          hint={`${t.porcentajeGanancia ?? 0}% sobre costo`}
          tone="primary"
        />
        <Kpi
          label="Ganancia real"
          value={r.gananciaReal !== 0 ? formatARS(r.gananciaReal) : "—"}
          hint="ventas − costo − gastos"
          tone={r.gananciaReal >= 0 ? "emerald" : "rose"}
        />
      </div>

      {/* Carga del camión */}
      {(t.carga ?? []).length > 0 && (
        <details className="border-t border-brand-border">
          <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-brand-dark hover:bg-primary-light/40">
            📦 Ver carga del camión ({(t.carga ?? []).length} ítem
            {(t.carga ?? []).length === 1 ? "" : "s"})
          </summary>
          <div className="border-t border-brand-border bg-slate-50/40 px-5 py-3">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase text-brand-dark/50">
                <tr>
                  <th className="py-1 text-left">Producto</th>
                  <th className="py-1 text-left">Descripción</th>
                  <th className="py-1 text-right">Unidades</th>
                </tr>
              </thead>
              <tbody>
                {(t.carga ?? []).map((it, i) => (
                  <tr
                    key={i}
                    className="border-t border-brand-border/40 first:border-t-0"
                  >
                    <td className="py-1.5 text-brand-dark">{it.producto}</td>
                    <td className="py-1.5 text-brand-dark/65">
                      {it.descripcion || "—"}
                    </td>
                    <td className="py-1.5 text-right font-semibold">
                      {it.cantidadUnidades}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {t.descripcion && (
        <p className="border-t border-brand-border bg-primary-light/20 px-5 py-2 text-xs italic text-brand-dark/65">
          {t.descripcion}
        </p>
      )}
    </article>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "emerald" | "rose" | "primary" | "dark";
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "rose"
      ? "text-rose-700"
      : tone === "primary"
      ? "text-primary"
      : tone === "dark"
      ? "text-brand-dark"
      : "text-brand-dark";
  return (
    <div className="bg-surface p-4">
      <p className="text-[10px] uppercase tracking-wider text-brand-dark/55">
        {label}
      </p>
      <p className={`mt-1 font-serif text-xl font-medium ${color}`}>{value}</p>
      {hint && <p className="text-[10px] text-brand-dark/45">{hint}</p>}
    </div>
  );
}
