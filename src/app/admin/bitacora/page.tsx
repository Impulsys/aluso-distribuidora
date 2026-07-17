"use client";

import { useEffect, useMemo, useState } from "react";
import {
  subscribeBitacoraRange,
  subscribeBitacoraRecent,
} from "@/lib/bitacora";
import { tsFromISO } from "@/lib/format";
import { ROLE_LABELS, type BitacoraEntry, type Role } from "@/lib/types";

const ROLE_CHIP: Record<Role, string> = {
  cliente: "bg-slate-200 text-slate-700",
  vendedor: "bg-sky-100 text-sky-800",
  socio: "bg-amber-100 text-amber-800",
  superadmin: "bg-emerald-100 text-emerald-800",
  contador: "bg-violet-100 text-violet-800",
};

function fechaHora(ts: number): { fecha: string; hora: string } {
  const d = new Date(ts);
  return {
    fecha: d.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    hora: d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
  };
}

export default function BitacoraPage() {
  const [entries, setEntries] = useState<BitacoraEntry[]>([]);
  const [dia, setDia] = useState(""); // YYYY-MM-DD; vacío = recientes
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!dia) {
      return subscribeBitacoraRecent(400, setEntries);
    }
    const start = tsFromISO(dia);
    const end = start + 24 * 60 * 60 * 1000;
    return subscribeBitacoraRange(start, end, setEntries);
  }, [dia]);

  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return entries;
    return entries.filter(
      (e) =>
        e.nombre.toLowerCase().includes(t) ||
        e.email.toLowerCase().includes(t) ||
        e.accion.toLowerCase().includes(t) ||
        (e.detalle ?? "").toLowerCase().includes(t)
    );
  }, [entries, q]);

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-serif text-2xl text-brand-dark">Bitácora</h2>
        <p className="text-sm text-brand-dark/60">
          Registro de todas las acciones del sistema (fecha, hora y usuario). No
          se puede editar ni borrar. Las pruebas del programador no se registran.
        </p>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="date"
          value={dia}
          onChange={(e) => setDia(e.target.value)}
          className="rounded-lg border border-brand-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
        />
        {dia && (
          <button
            onClick={() => setDia("")}
            className="rounded-lg bg-primary-light px-3 py-2 text-sm font-medium text-primary"
          >
            ← Ver recientes
          </button>
        )}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por usuario, acción o detalle…"
          className="w-full rounded-lg border border-brand-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary sm:max-w-xs"
        />
        <span className="text-sm text-brand-dark/50 sm:ml-auto">
          {visible.length} movimiento{visible.length === 1 ? "" : "s"}
          {!dia && " (recientes)"}
        </span>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-xl border border-brand-border bg-surface">
        <div className="hidden grid-cols-[150px_minmax(0,1fr)_minmax(0,1.4fr)] gap-3 border-b border-brand-border bg-primary-light px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-primary md:grid">
          <span>Fecha y hora</span>
          <span>Usuario</span>
          <span>Acción</span>
        </div>

        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-brand-dark/50">
            Sin movimientos {dia ? "ese día" : "registrados"}.
          </p>
        ) : (
          <ul className="divide-y divide-brand-border">
            {visible.map((e) => {
              const { fecha, hora } = fechaHora(e.ts);
              return (
                <li
                  key={e.id}
                  className="grid grid-cols-1 gap-1 px-4 py-3 text-sm md:grid-cols-[150px_minmax(0,1fr)_minmax(0,1.4fr)] md:gap-3"
                >
                  <div className="text-brand-dark/70">
                    <span className="font-medium text-brand-dark">{fecha}</span>{" "}
                    <span className="tabular-nums">{hora}</span>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-brand-dark">
                        {e.nombre}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          ROLE_CHIP[e.role] ?? "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {ROLE_LABELS[e.role] ?? e.role}
                      </span>
                    </div>
                    {/* El mail identifica sin ambigüedad: dos personas pueden
                        tener el mismo nombre para mostrar. */}
                    {e.email && e.email !== e.nombre && (
                      <span className="text-[11px] text-brand-dark/45">
                        {e.email}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="font-semibold text-brand-dark">
                      {e.accion}
                    </span>
                    {e.detalle && (
                      <span className="text-brand-dark/60"> · {e.detalle}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
