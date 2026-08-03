"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeRemitos, marcarCobrado, desmarcarCobrado } from "@/lib/ventas";
import { subscribeClientes } from "@/lib/clientes";
import { deudaPorCliente } from "@/lib/cobros";
import { useAuth } from "@/context/AuthContext";
import { formatARS, formatDate, tsFromISO, isoFromTs, daysBetween } from "@/lib/format";
import type { Cliente, Remito } from "@/lib/types";

function hoyISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export default function CuentaCorrienteClientesPage() {
  const { user } = useAuth();
  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [soloConDeuda, setSoloConDeuda] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => subscribeRemitos(setRemitos), []);
  useEffect(() => subscribeClientes(setClientes), []);

  const saldos = useMemo(
    () => deudaPorCliente(remitos, clientes),
    [remitos, clientes]
  );
  const visibles = soloConDeuda ? saldos.filter((s) => s.deuda > 0.01) : saldos;

  // Remitos del cliente abierto (pendientes primero, luego cobrados).
  const remitosDe = useMemo(() => {
    if (!abierto) return [];
    return remitos
      .filter((r) => {
        if (r.anulado) return false;
        const key = r.clienteId || `nombre:${(r.clienteNombre || "").trim().toLowerCase()}`;
        return key === abierto;
      })
      .sort((a, b) => {
        if (!!a.cobrado !== !!b.cobrado) return a.cobrado ? 1 : -1;
        return b.fecha - a.fecha;
      });
  }, [abierto, remitos]);

  const totalCalle = saldos.reduce((s, x) => s + x.deuda, 0);
  const conDeuda = saldos.filter((s) => s.deuda > 0.01).length;

  async function cobrar(r: Remito, fechaISO: string) {
    setBusy(r.id);
    try {
      await marcarCobrado(r, user?.displayName, tsFromISO(fechaISO));
    } finally {
      setBusy(null);
    }
  }
  async function revertir(r: Remito) {
    setBusy(r.id);
    try {
      await desmarcarCobrado(r);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5">
        <h1 className="flex items-center gap-2 font-serif text-2xl font-medium text-brand-dark">
          <span className="text-3xl">💳</span> Cuenta corriente de clientes
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-brand-dark/60">
          Lo que debe cada cliente: remitos entregados que todavía no se
          cobraron. Al registrar el cobro, la comisión del vendedor se cuenta en
          el mes de la fecha de cobro (no en el de la venta).
        </p>
      </div>

      {/* Resumen */}
      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-brand-border bg-surface p-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-brand-dark/50">
            Total en la calle
          </p>
          <p className="font-serif text-3xl font-medium text-primary">
            {formatARS(totalCalle)}
          </p>
        </div>
        <div className="border-l border-brand-border pl-4">
          <p className="text-[11px] uppercase tracking-wider text-brand-dark/50">
            Clientes con deuda
          </p>
          <p className="font-serif text-3xl font-medium text-brand-dark">
            {conDeuda}
          </p>
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm text-brand-dark/70">
          <input
            type="checkbox"
            checked={soloConDeuda}
            onChange={(e) => setSoloConDeuda(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Solo con deuda
        </label>
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-brand-border bg-surface p-8 text-center text-sm text-brand-dark/55">
          {soloConDeuda
            ? "Nadie debe nada. Toda la calle está al día. 🎉"
            : "Todavía no hay clientes con movimiento."}
        </p>
      ) : (
        <div className="space-y-2">
          {visibles.map((s) => {
            const key = s.clienteId;
            const isOpen = abierto === key;
            const diasAtraso =
              s.masViejoPendiente != null
                ? daysBetween(s.masViejoPendiente, Date.now())
                : 0;
            return (
              <article
                key={key}
                className="overflow-hidden rounded-2xl border border-brand-border bg-surface shadow-sm"
              >
                <button
                  onClick={() => setAbierto(isOpen ? null : key)}
                  className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-primary-light/40"
                >
                  <span
                    className={`text-brand-dark/40 transition ${isOpen ? "rotate-90" : ""}`}
                  >
                    ▶
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-brand-dark">
                      {s.nombre}
                    </p>
                    <p className="text-xs text-brand-dark/55">
                      {s.pendientes > 0 ? (
                        <>
                          {s.pendientes} remito{s.pendientes > 1 ? "s" : ""} sin
                          cobrar
                          {diasAtraso > 0 && (
                            <>
                              {" · "}
                              <span
                                className={
                                  diasAtraso > 30
                                    ? "font-semibold text-red-600"
                                    : "text-brand-dark/55"
                                }
                              >
                                el más viejo hace {diasAtraso} días
                              </span>
                            </>
                          )}
                        </>
                      ) : (
                        <span className="text-emerald-600">al día</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-serif text-xl font-medium ${
                        s.deuda > 0.01 ? "text-primary" : "text-emerald-600"
                      }`}
                    >
                      {formatARS(s.deuda)}
                    </p>
                    <p className="text-[11px] text-brand-dark/45">
                      de {formatARS(s.vendido)}
                    </p>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-brand-border bg-primary-light/20 px-4 py-3">
                    <ul className="space-y-2">
                      {remitosDe.map((r) => (
                        <li
                          key={r.id}
                          className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-border bg-surface px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-brand-dark">
                              {r.numero}{" "}
                              <span className="font-normal text-brand-dark/50">
                                · {formatDate(r.fecha)}
                              </span>
                            </p>
                            {r.cobrado && r.fechaCobro && (
                              <p className="text-[11px] text-emerald-600">
                                ✓ cobrado {formatDate(r.fechaCobro)}
                                {r.cobradoPor ? ` · ${r.cobradoPor}` : ""}
                              </p>
                            )}
                          </div>
                          <span className="font-serif text-base font-medium text-brand-dark tabular-nums">
                            {formatARS(r.total)}
                          </span>
                          {r.cobrado ? (
                            <button
                              disabled={busy === r.id}
                              onClick={() => revertir(r)}
                              className="rounded-lg border border-brand-border px-2.5 py-1 text-xs text-brand-dark/60 transition hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                            >
                              revertir
                            </button>
                          ) : (
                            <CobrarBtn
                              busy={busy === r.id}
                              onCobrar={(iso) => cobrar(r, iso)}
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Botón de cobro con selector de fecha (default hoy). La fecha define en qué
 *  mes cae la comisión del vendedor, así que se puede elegir. */
function CobrarBtn({
  busy,
  onCobrar,
}: {
  busy: boolean;
  onCobrar: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [fecha, setFecha] = useState(hoyISO());

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white transition hover:bg-primary/90"
      >
        ✓ Cobrar
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="date"
        value={fecha}
        max={isoFromTs(Date.now())}
        onChange={(e) => setFecha(e.target.value)}
        className="rounded-lg border border-brand-border px-2 py-1 text-xs outline-none focus:border-primary"
      />
      <button
        disabled={busy}
        onClick={() => onCobrar(fecha)}
        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? "…" : "Confirmar"}
      </button>
      <button
        onClick={() => setOpen(false)}
        className="rounded-lg px-1.5 py-1 text-xs text-brand-dark/50 hover:text-brand-dark"
      >
        ✕
      </button>
    </div>
  );
}
