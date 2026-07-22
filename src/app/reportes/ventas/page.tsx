"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeRemitosRange } from "@/lib/ventas";
import { formatARS, formatDate, tsFromISO } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import {
  DEFAULT_REPORTES_CONFIG,
  subscribeReportesConfig,
  type ReportesConfig,
} from "@/lib/config";
import type { Remito } from "@/lib/types";

function todayISO() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t.toISOString().slice(0, 10);
}

export default function ReportesVentasPage() {
  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [dia, setDia] = useState(todayISO());

  // Esta pantalla mostraba "Costo mercadería vendida" y "Margen del día" SIN
  // consultar la configuración: apagar "mostrar ganancia a los socios" en
  // /admin/configuracion no tenía ningún efecto acá, y el botón "Ver caja →"
  // de /reportes —que sí está siempre visible— lleva justo a esta página.
  // O sea que el candado se esquivaba en un clic.
  const { user } = useAuth();
  const [config, setConfig] = useState<ReportesConfig>(DEFAULT_REPORTES_CONFIG);
  useEffect(() => subscribeReportesConfig(setConfig), []);
  const showGanancia =
    user?.role === "superadmin" || config.mostrarGananciaASocios;
  const cols = showGanancia
    ? "grid-cols-[1fr_110px_110px_110px]"
    : "grid-cols-[1fr_110px]";

  // Solo los remitos del día seleccionado (no toda la colección).
  useEffect(() => {
    const start = tsFromISO(dia);
    return subscribeRemitosRange(start, start + 86_400_000, setRemitos);
  }, [dia]);

  const { delDia, venta, costo, margen } = useMemo(() => {
    const delDia = remitos.filter((r) => !r.anulado);
    const venta = delDia.reduce((s, r) => s + r.total, 0);
    const costo = delDia.reduce(
      (s, r) =>
        s + r.items.reduce((a, it) => a + it.cantidad * it.costoUnitario, 0),
      0
    );
    return { delDia, venta, costo, margen: venta - costo };
  }, [remitos, dia]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-dark/65">
          Movimientos de caja del día: ventas (remitos), costo de la mercadería
          vendida y margen.
        </p>
        <input
          type="date"
          value={dia}
          onChange={(e) => setDia(e.target.value)}
          className="rounded-lg border border-brand-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>

      {/* Totales del día */}
      <div
        className={`mb-5 grid gap-3 ${showGanancia ? "sm:grid-cols-3" : ""}`}
      >
        <Kpi label="Venta del día" value={venta} tone="emerald" />
        {showGanancia && (
          <>
            <Kpi label="Costo mercadería vendida" value={costo} tone="rose" />
            <Kpi label="Margen del día" value={margen} tone="primary" />
          </>
        )}
      </div>

      {/* Detalle */}
      {delDia.length === 0 ? (
        <div className="rounded-2xl border border-brand-border bg-surface p-10 text-center text-brand-dark/55">
          No hubo ventas (remitos) este día.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-brand-border bg-surface">
          <div
            className={`grid ${cols} gap-2 bg-primary-light/40 px-4 py-2 text-[11px] font-bold uppercase text-primary`}
          >
            <span>Remito / cliente</span>
            <span className="text-right">Venta</span>
            {showGanancia && (
              <>
                <span className="text-right">Costo</span>
                <span className="text-right">Margen</span>
              </>
            )}
          </div>
          {delDia.map((r) => {
            const c = r.items.reduce(
              (a, it) => a + it.cantidad * it.costoUnitario,
              0
            );
            return (
              <div
                key={r.id}
                className={`grid ${cols} gap-2 border-t border-brand-border px-4 py-2 text-sm`}
              >
                <span>
                  <b className="text-brand-dark">{r.numero}</b>{" "}
                  <span className="text-brand-dark/55">
                    {r.clienteNombre || ""} · {formatDate(r.fecha)}
                  </span>
                </span>
                <span className="text-right font-semibold text-emerald-700">
                  {formatARS(r.total)}
                </span>
                {showGanancia && (
                  <>
                    <span className="text-right text-rose-700">
                      {formatARS(c)}
                    </span>
                    <span className="text-right font-semibold text-primary">
                      {formatARS(r.total - c)}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "rose" | "primary";
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
    <div
      className={`rounded-2xl border border-brand-border bg-gradient-to-br ${bg} to-surface p-5 shadow-sm`}
    >
      <p className="text-[11px] uppercase tracking-wider text-brand-dark/55">
        {label}
      </p>
      <p className={`mt-1 font-serif text-3xl font-medium ${color}`}>
        {value !== 0 ? formatARS(value) : "—"}
      </p>
    </div>
  );
}
