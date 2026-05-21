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
import MonthCalendar from "@/components/MonthCalendar";
import DayReportModal from "@/components/DayReportModal";
import type { Order, Truck } from "@/lib/types";

export default function ReportesPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dayOpen, setDayOpen] = useState<number | null>(null);

  // Suscripción a camiones (tiempo real)
  useEffect(() => {
    const unsub = subscribeTrucks(setTrucks);
    return unsub;
  }, []);

  // Fetch de pedidos del año
  useEffect(() => {
    const startTs = new Date(year, 0, 1).getTime();
    const endTs = new Date(year + 1, 0, 1).getTime();
    setLoading(true);
    getDocs(
      query(
        collection(db, "orders"),
        where("createdAt", ">=", startTs),
        where("createdAt", "<", endTs)
      )
    )
      .then((snap) => {
        const data = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Order)
        );
        setOrders(data);
        setError(null);
      })
      .catch((e) => {
        console.error(e);
        setError("No se pudieron cargar los pedidos del año.");
      })
      .finally(() => setLoading(false));
  }, [year]);

  // Activos para la leyenda
  const trucksConRangos = useMemo(() => {
    const yearStart = new Date(year, 0, 1).getTime();
    const yearEnd = new Date(year + 1, 0, 1).getTime();
    return trucks.filter(
      (t) =>
        t.fechaIngreso < yearEnd &&
        (!t.fechaCierre || t.fechaCierre > yearStart)
    );
  }, [trucks, year]);

  return (
    <div>
      <p className="mb-4 text-sm text-brand-dark/65">
        Movimientos de venta por día. Tocá cualquier día para ver el detalle.
      </p>

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

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-brand-dark/65">
      <span className={`h-3 w-3 rounded ${swatch}`} />
      {label}
    </span>
  );
}
