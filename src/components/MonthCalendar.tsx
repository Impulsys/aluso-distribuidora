"use client";

import { useMemo } from "react";
import { findTruckForDay } from "@/lib/trucks";
import type { Order, Remito, Truck } from "@/lib/types";

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
const DAY_HEADERS = ["L", "M", "M", "J", "V", "S", "D"];

function dayStartTs(year: number, month: number, day: number): number {
  const d = new Date(year, month, day);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function dayEndTs(year: number, month: number, day: number): number {
  const d = new Date(year, month, day);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export interface MonthCalendarProps {
  year: number;
  month: number; // 0-11
  trucks: Truck[];
  remitos: Remito[]; // ventas (remitos) del año
  orders?: Order[]; // pedidos (para puntito de vendedor y de entrega)
  onDayClick: (ts: number) => void;
}

export default function MonthCalendar({
  year,
  month,
  trucks,
  remitos,
  orders = [],
  onDayClick,
}: MonthCalendarProps) {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t.getTime();
  }, []);

  // Primer día del mes y cuántos días tiene
  const firstDay = new Date(year, month, 1);
  // En JS, getDay() devuelve 0=Dom, 1=Lun... queremos columna 0=Lun, 6=Dom
  const offset = (firstDay.getDay() + 6) % 7; // shift Dom→6
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Pre-armar el array de celdas (con vacíos al inicio)
  const cells: ({ day: number } | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });

  // Cuenta ventas (remitos) por día del mes
  const ventasByDay = useMemo(() => {
    const map = new Map<number, number>();
    remitos.forEach((r) => {
      if (r.anulado) return;
      const d = new Date(r.fecha);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        map.set(day, (map.get(day) ?? 0) + 1);
      }
    });
    return map;
  }, [remitos, year, month]);

  // Días en que vendió un VENDEDOR (puntito púrpura) y días con entrega
  // agendada (puntito azul).
  const { vendioVendedor, conEntrega } = useMemo(() => {
    const v = new Set<number>();
    const e = new Set<number>();
    orders.forEach((o) => {
      if (o.createdByRole === "vendedor") {
        const d = new Date(o.createdAt);
        if (d.getFullYear() === year && d.getMonth() === month)
          v.add(d.getDate());
      }
      if (o.fechaEntrega) {
        const d = new Date(o.fechaEntrega);
        if (d.getFullYear() === year && d.getMonth() === month)
          e.add(d.getDate());
      }
    });
    return { vendioVendedor: v, conEntrega: e };
  }, [orders, year, month]);

  return (
    <div className="rounded-xl border border-brand-border bg-surface p-3 shadow-sm">
      <h3 className="mb-2 px-1 font-serif text-lg font-medium text-brand-dark">
        {MONTH_NAMES[month]}{" "}
        <span className="text-brand-dark/45">{year}</span>
      </h3>

      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold uppercase text-brand-dark/40">
        {DAY_HEADERS.map((d, i) => (
          <span key={i} className="py-1">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} className="aspect-square" />;
          const dayStart = dayStartTs(year, month, cell.day);
          const dayEnd = dayEndTs(year, month, cell.day);
          const truck = findTruckForDay(trucks, dayStart);
          const hasVentas = (ventasByDay.get(cell.day) ?? 0) > 0;

          // Estado del día
          let bg = "bg-slate-100"; // futuro / sin info
          let text = "text-slate-400";
          if (dayStart <= today) {
            // pasado o hoy
            if (hasVentas) {
              bg = "bg-emerald-200/80 hover:bg-emerald-300";
              text = "text-emerald-900";
            } else {
              bg = "bg-rose-200/70 hover:bg-rose-300";
              text = "text-rose-900";
            }
          } else {
            // futuro
            bg = "bg-slate-100 hover:bg-slate-200";
            text = "text-slate-400";
          }
          const isToday = dayStart === today;

          return (
            <button
              key={i}
              onClick={() => onDayClick(dayEnd)}
              className={`group relative aspect-square overflow-hidden rounded-md text-xs font-semibold transition ${bg} ${text} ${
                isToday ? "ring-2 ring-primary ring-offset-1" : ""
              }`}
            >
              {/* Banda superior con color del camión activo */}
              {truck && (
                <span
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ background: truck.color }}
                  aria-hidden
                />
              )}
              <span className="absolute inset-0 grid place-items-center">
                {cell.day}
              </span>
              {/* Puntitos: púrpura = vendió un vendedor · azul = entrega agendada */}
              {(vendioVendedor.has(cell.day) || conEntrega.has(cell.day)) && (
                <span className="absolute inset-x-0 bottom-0.5 flex justify-center gap-0.5">
                  {vendioVendedor.has(cell.day) && (
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
                  )}
                  {conEntrega.has(cell.day) && (
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
