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

  // Por cada camión: KPIs + breakdown por producto del cargo
  const reports = useMemo(
    () =>
      trucksAnio.map((t) => {
        const start = t.fechaIngreso;
        const end = t.fechaCierre ?? Date.now();
        const orderMatches = orders.filter(
          (o) =>
            o.status !== "cancelado" &&
            (o.truckId === t.id ||
              (!o.truckId && o.createdAt >= start && o.createdAt <= end))
        );
        const expenseMatches = expenses.filter(
          (e) => e.fecha >= start && e.fecha <= end
        );
        const totalGastos = expenseMatches.reduce((s, e) => s + e.monto, 0);
        const costoCamion = t.costoCamion ?? 0;
        const dias = daysBetween(start, end);

        // === Breakdown por producto del cargo ===
        const cargo = t.carga ?? [];
        const items = cargo.map((c) => {
          // Sumar unidades vendidas del producto en orders del rango
          let vendidas = 0;
          let ingresoReal = 0;
          orderMatches.forEach((o) => {
            o.items.forEach((it) => {
              if (it.productId === c.productId) {
                vendidas += it.cantidad;
                ingresoReal += it.cantidad * (it.precioVenta || 0);
              }
            });
          });
          const cargadas = c.cantidadUnidades;
          const restante = Math.max(0, cargadas - vendidas);
          const costoTotal = cargadas * (c.costoUnitario ?? 0);
          const costoVendido = vendidas * (c.costoUnitario ?? 0);
          const margenReal = ingresoReal - costoVendido;
          return {
            cargo: c,
            cargadas,
            vendidas,
            restante,
            costoUnitario: c.costoUnitario ?? 0,
            precioVentaOptimo: c.precioVentaOptimo ?? 0,
            costoTotal,
            costoVendido,
            ingresoReal,
            margenReal,
            liquidado: cargadas > 0 && restante === 0,
          };
        });

        // Totales basados en el cargo
        const costoTotalCargo = items.reduce((s, i) => s + i.costoTotal, 0);
        const ingresoRealCargo = items.reduce((s, i) => s + i.ingresoReal, 0);
        const margenRealCargo = items.reduce((s, i) => s + i.margenReal, 0);
        const totalCargadas = items.reduce((s, i) => s + i.cargadas, 0);
        const totalVendidas = items.reduce((s, i) => s + i.vendidas, 0);
        const totalRestante = totalCargadas - totalVendidas;
        const todoLiquidado = cargo.length > 0 && totalRestante === 0;

        // Ganancia real DEL CAMIÓN = margen del cargo − gastos imputados − costo camión adicional
        // (el costoCamion del header es independiente de los costos unitarios del cargo)
        const gananciaReal = margenRealCargo - totalGastos - costoCamion;
        const gananciaEstimada =
          (costoTotalCargo * (t.porcentajeGanancia ?? 0)) / 100;

        return {
          truck: t,
          orderCount: orderMatches.length,
          dias,
          activo: !t.fechaCierre,
          // Items
          items,
          // Totales
          totalCargadas,
          totalVendidas,
          totalRestante,
          todoLiquidado,
          costoTotalCargo,
          ingresoRealCargo,
          margenRealCargo,
          totalGastos,
          costoCamion,
          gananciaEstimada,
          gananciaReal,
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
interface TruckReport {
  truck: Truck;
  orderCount: number;
  dias: number;
  activo: boolean;
  items: {
    cargo: import("@/lib/types").TruckCargoItem;
    cargadas: number;
    vendidas: number;
    restante: number;
    costoUnitario: number;
    precioVentaOptimo: number;
    costoTotal: number;
    costoVendido: number;
    ingresoReal: number;
    margenReal: number;
    liquidado: boolean;
  }[];
  totalCargadas: number;
  totalVendidas: number;
  totalRestante: number;
  todoLiquidado: boolean;
  costoTotalCargo: number;
  ingresoRealCargo: number;
  margenRealCargo: number;
  totalGastos: number;
  costoCamion: number;
  gananciaEstimada: number;
  gananciaReal: number;
}

function TruckReportCard({ r }: { r: TruckReport }) {
  const { truck: t } = r;
  const proveedor =
    t.proveedor === "otro" ? t.proveedorOtro || "(sin nombre)" : t.proveedor;
  const transporte =
    t.transporte === "otro" ? t.transporteOtro || "(sin nombre)" : t.transporte;

  // Estado del camión: activo / liquidado / cerrado parcial
  const estado = r.todoLiquidado
    ? { label: "Liquidado", style: "bg-violet-100 text-violet-800", dot: "bg-violet-500" }
    : r.activo
    ? { label: "Activo", style: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500" }
    : { label: "Cerrado", style: "bg-slate-100 text-slate-700", dot: "bg-slate-400" };

  return (
    <article className="overflow-hidden rounded-2xl border border-brand-border bg-surface shadow-sm">
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
              <span
                className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 align-middle text-[10px] font-bold uppercase ${estado.style}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${estado.dot} ${
                    r.activo && !r.todoLiquidado ? "animate-pulse" : ""
                  }`}
                />
                {estado.label}
              </span>
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

      {/* KPIs operativos */}
      <div className="grid grid-cols-2 gap-px bg-brand-border sm:grid-cols-4">
        <Kpi
          label="Días operando"
          value={`${r.dias} d`}
          hint={r.activo ? "hasta hoy" : "total cerrado"}
        />
        <Kpi
          label="Pedidos asociados"
          value={r.orderCount}
          hint="dentro del rango"
        />
        <Kpi
          label="Unidades vendidas"
          value={`${r.totalVendidas} / ${r.totalCargadas}`}
          hint={`${r.totalRestante} restante${r.totalRestante === 1 ? "" : "s"}`}
          tone={r.todoLiquidado ? "primary" : undefined}
        />
        <Kpi
          label="Gastos imputados"
          value={r.totalGastos > 0 ? formatARS(r.totalGastos) : "—"}
          hint="del rango"
          tone="rose"
        />
      </div>

      {/* Económico del cargo */}
      <div className="grid grid-cols-2 gap-px bg-brand-border sm:grid-cols-4">
        <Kpi
          label="Costo del cargo"
          value={r.costoTotalCargo > 0 ? formatARS(r.costoTotalCargo) : "—"}
          hint="suma costo × cantidad"
          tone="dark"
        />
        <Kpi
          label="Ingreso real"
          value={r.ingresoRealCargo > 0 ? formatARS(r.ingresoRealCargo) : "—"}
          hint="ventas reales"
          tone="emerald"
        />
        <Kpi
          label="Margen del cargo"
          value={
            r.margenRealCargo !== 0 ? formatARS(r.margenRealCargo) : "—"
          }
          hint="ingreso − costo vendido"
          tone={r.margenRealCargo >= 0 ? "emerald" : "rose"}
        />
        <Kpi
          label="Ganancia REAL camión"
          value={r.gananciaReal !== 0 ? formatARS(r.gananciaReal) : "—"}
          hint="margen − gastos − costo extra"
          tone={r.gananciaReal >= 0 ? "emerald" : "rose"}
        />
      </div>

      {/* Carga del camión — breakdown completo por producto */}
      {r.items.length > 0 && (
        <details className="border-t border-brand-border" open={r.activo}>
          <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-brand-dark hover:bg-primary-light/40">
            📦 Detalle por producto ({r.items.length} ítem
            {r.items.length === 1 ? "" : "s"} cargados)
          </summary>
          <div className="overflow-x-auto border-t border-brand-border bg-slate-50/40">
            <table className="w-full text-xs">
              <thead className="bg-primary-light/30 text-[10px] uppercase text-primary">
                <tr>
                  <th className="px-3 py-2 text-left">Producto</th>
                  <th className="px-3 py-2 text-right">Cargadas</th>
                  <th className="px-3 py-2 text-right">Vendidas</th>
                  <th className="px-3 py-2 text-right">Restantes</th>
                  <th className="px-3 py-2 text-right">Costo u.</th>
                  <th className="px-3 py-2 text-right">Venta ópt.</th>
                  <th className="px-3 py-2 text-right">Ingreso real</th>
                  <th className="px-3 py-2 text-right">Margen</th>
                </tr>
              </thead>
              <tbody>
                {r.items.map((it, i) => (
                  <tr
                    key={i}
                    className="border-t border-brand-border/40 first:border-t-0"
                  >
                    <td className="px-3 py-2">
                      <p className="text-brand-dark">{it.cargo.producto}</p>
                      {it.cargo.descripcion && (
                        <p className="text-[10px] text-brand-dark/55">
                          {it.cargo.descripcion}
                        </p>
                      )}
                      {it.liquidado && (
                        <span className="mt-0.5 inline-block rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-800">
                          Liquidado
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{it.cargadas}</td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                      {it.vendidas}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-medium ${
                        it.restante === 0 ? "text-violet-700" : "text-brand-dark/70"
                      }`}
                    >
                      {it.restante}
                    </td>
                    <td className="px-3 py-2 text-right text-brand-dark/70">
                      {formatARS(it.costoUnitario)}
                    </td>
                    <td className="px-3 py-2 text-right text-brand-dark/60">
                      {it.precioVentaOptimo
                        ? formatARS(it.precioVentaOptimo)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-700">
                      {it.ingresoReal > 0 ? formatARS(it.ingresoReal) : "—"}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-bold ${
                        it.margenReal >= 0 ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {it.margenReal !== 0 ? formatARS(it.margenReal) : "—"}
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
