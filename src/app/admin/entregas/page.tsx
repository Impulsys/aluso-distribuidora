"use client";

import { useEffect, useMemo, useState } from "react";
import {
  subscribeOrdersByEntrega,
  setOrderEntregado,
} from "@/lib/orders";
import { formatARS, tsFromISO } from "@/lib/format";
import type { Order } from "@/lib/types";

function isoHoy(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function EntregasPage() {
  const [dia, setDia] = useState(isoHoy());
  const [pedidos, setPedidos] = useState<Order[]>([]);

  useEffect(() => {
    const start = tsFromISO(dia);
    const end = start + 24 * 60 * 60 * 1000;
    return subscribeOrdersByEntrega(start, end, setPedidos);
  }, [dia]);

  const { pendientes, entregadas } = useMemo(
    () => ({
      pendientes: pedidos.filter((p) => !p.entregado).length,
      entregadas: pedidos.filter((p) => p.entregado).length,
    }),
    [pedidos]
  );

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-serif text-2xl text-brand-dark">Entregas</h2>
        <p className="text-sm text-brand-dark/60">
          Elegí un día y mirá las entregas agendadas. Tildá cada una cuando se
          entregó.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={dia}
          onChange={(e) => setDia(e.target.value)}
          className="rounded-lg border border-brand-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={() => setDia(isoHoy())}
          className="rounded-lg bg-primary-light px-3 py-2 text-sm font-medium text-primary"
        >
          Hoy
        </button>
        <span className="text-sm text-brand-dark/60 sm:ml-auto">
          {pedidos.length} entrega{pedidos.length === 1 ? "" : "s"} ·{" "}
          <b className="text-emerald-700">{entregadas} listas</b> ·{" "}
          <b className="text-rose-700">{pendientes} pendientes</b>
        </span>
      </div>

      {pedidos.length === 0 ? (
        <p className="rounded-xl border border-brand-border bg-surface px-4 py-10 text-center text-sm text-brand-dark/50">
          No hay entregas agendadas para ese día.
        </p>
      ) : (
        <ul className="space-y-2">
          {pedidos.map((p) => (
            <li
              key={p.id}
              className={`rounded-xl border bg-surface p-3 ${
                p.entregado
                  ? "border-emerald-300 bg-emerald-50/40"
                  : "border-brand-border"
              }`}
            >
              <div className="flex items-start gap-3">
                <label className="mt-0.5 flex shrink-0 cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={!!p.entregado}
                    onChange={(e) => setOrderEntregado(p.id, e.target.checked)}
                    className="h-5 w-5 cursor-pointer accent-emerald-600"
                  />
                </label>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-brand-dark">
                      {p.clienteRazonSocial || p.clienteNombre || "Cliente"}
                    </span>
                    {p.horarioEntrega && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                        🕒 {p.horarioEntrega}
                      </span>
                    )}
                    {p.entregado && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                        ✓ ENTREGADO
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-brand-dark/60">
                    {[
                      p.clienteDireccion || p.notas,
                      p.clienteTelefono,
                      p.createdByName && `vend.: ${p.createdByName}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="mt-1 text-xs text-brand-dark/70">
                    {p.items.reduce((s, it) => s + it.cantidad, 0)} u. ·{" "}
                    {p.items
                      .slice(0, 3)
                      .map((it) => `${it.cantidad}× ${it.nombre}`)
                      .join(", ")}
                    {p.items.length > 3 ? "…" : ""}
                  </p>
                </div>
                <span className="shrink-0 font-bold text-primary">
                  {formatARS(p.total)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
