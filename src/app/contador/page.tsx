"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeRemitos, subscribeFacturas } from "@/lib/ventas";
import { openRemito } from "@/lib/remito-print";
import { openFactura } from "@/lib/factura-print";
import { formatARS, isoFromTs, tsFromISO } from "@/lib/format";
import type { Factura, Remito } from "@/lib/types";

type Tab = "remitos" | "facturas";

// Fechas en hora LOCAL: con toISOString() (UTC), después de las 21 hs argentinas
// el filtro arrancaba en el día siguiente y no mostraba nada.
function isoHoy(): string {
  return isoFromTs(Date.now());
}
function isoInicioMes(): string {
  const d = new Date();
  return isoFromTs(new Date(d.getFullYear(), d.getMonth(), 1).getTime());
}
function fechaHora(ts: number): string {
  const d = new Date(ts);
  return (
    d.toLocaleDateString("es-AR") +
    " " +
    d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
  );
}

export default function ContadorPage() {
  const [tab, setTab] = useState<Tab>("remitos");
  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [desde, setDesde] = useState(isoInicioMes());
  const [hasta, setHasta] = useState(isoHoy());
  const [verAnulados, setVerAnulados] = useState(true);

  useEffect(() => subscribeRemitos(setRemitos), []);
  useEffect(() => subscribeFacturas(setFacturas), []);

  const rango = useMemo(() => {
    const start = tsFromISO(desde);
    const end = tsFromISO(hasta) + 24 * 60 * 60 * 1000; // hasta inclusive
    return { start, end };
  }, [desde, hasta]);

  const remitosVis = useMemo(
    () =>
      remitos.filter(
        (r) =>
          r.fecha >= rango.start &&
          r.fecha < rango.end &&
          (verAnulados || !r.anulado)
      ),
    [remitos, rango, verAnulados]
  );

  const facturasVis = useMemo(
    () => facturas.filter((f) => f.fecha >= rango.start && f.fecha < rango.end),
    [facturas, rango]
  );

  const totalRemitos = remitosVis
    .filter((r) => !r.anulado)
    .reduce((s, r) => s + r.total, 0);
  const totalFacturas = facturasVis.reduce((s, f) => s + f.total, 0);

  return (
    <div>
      {/* Tabs */}
      <div className="mb-4 inline-flex overflow-hidden rounded-xl bg-surface p-1 ring-1 ring-brand-border">
        {(["remitos", "facturas"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-5 py-1.5 text-sm font-medium capitalize transition ${
              tab === t
                ? "bg-primary text-white"
                : "text-brand-dark hover:bg-primary-light"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-col flex-wrap gap-2 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-sm text-brand-dark/70">
          Desde
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="rounded-lg border border-brand-border bg-surface px-3 py-2 outline-none focus:border-primary"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-brand-dark/70">
          Hasta
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="rounded-lg border border-brand-border bg-surface px-3 py-2 outline-none focus:border-primary"
          />
        </label>
        {tab === "remitos" && (
          <label className="flex items-center gap-2 text-sm text-brand-dark/70">
            <input
              type="checkbox"
              checked={verAnulados}
              onChange={(e) => setVerAnulados(e.target.checked)}
            />
            Incluir anulados
          </label>
        )}
      </div>

      {tab === "remitos" ? (
        <>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-sm text-brand-dark/60">
              {remitosVis.length} remito{remitosVis.length === 1 ? "" : "s"}
            </span>
            <span className="text-sm">
              Total (sin anulados):{" "}
              <b className="text-primary">{formatARS(totalRemitos)}</b>
            </span>
          </div>
          {remitosVis.length === 0 ? (
            <p className="rounded-xl border border-brand-border bg-surface px-4 py-10 text-center text-sm text-brand-dark/50">
              Sin remitos en el período.
            </p>
          ) : (
            <ul className="space-y-3">
              {remitosVis.map((r) => (
                <li
                  key={r.id}
                  className={`rounded-xl border border-brand-border bg-surface p-4 ${
                    r.anulado ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-brand-dark">
                        {r.numero}
                      </span>
                      {r.anulado && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                          ANULADA
                        </span>
                      )}
                      {r.facturaId && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          FACTURADA
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-brand-dark/60">
                      {fechaHora(r.fecha)}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-brand-dark/70">
                    {r.clienteNombre || "Consumidor final"}
                    {r.formaPago ? ` · ${r.formaPago}` : ""}
                    {r.clienteCuit ? ` · CUIT ${r.clienteCuit}` : ""}
                  </div>
                  <ul className="mt-2 border-t border-dashed border-brand-border pt-2 text-sm">
                    {r.items.map((it, i) => (
                      <li
                        key={i}
                        className="flex justify-between text-brand-dark/80"
                      >
                        <span>
                          {it.nombre}{" "}
                          <span className="text-brand-dark/50">
                            ({it.cantidad} × {formatARS(it.precioVenta)})
                          </span>
                        </span>
                        <span className="tabular-nums">
                          {formatARS(it.precioVenta * it.cantidad)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex items-center justify-between border-t border-brand-border pt-2">
                    <button
                      onClick={() => openRemito(r)}
                      className="rounded-lg bg-primary-light px-3 py-1.5 text-xs font-semibold text-primary"
                    >
                      🖨️ Ver / imprimir
                    </button>
                    <span className="text-base font-extrabold text-brand-dark">
                      {formatARS(r.total)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-sm text-brand-dark/60">
              {facturasVis.length} factura{facturasVis.length === 1 ? "" : "s"}
            </span>
            <span className="text-sm">
              Total: <b className="text-primary">{formatARS(totalFacturas)}</b>
            </span>
          </div>
          {facturasVis.length === 0 ? (
            <p className="rounded-xl border border-brand-border bg-surface px-4 py-10 text-center text-sm text-brand-dark/50">
              Sin facturas en el período.
            </p>
          ) : (
            <ul className="space-y-3">
              {facturasVis.map((f) => (
                <li
                  key={f.id}
                  className="rounded-xl border border-brand-border bg-surface p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                        Factura {f.tipo}
                      </span>
                      <span className="font-bold text-brand-dark">
                        {f.numero || f.remitoNumero}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          f.estado === "emitida"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {f.estado === "emitida" ? "EMITIDA (AFIP)" : "INTERNA"}
                      </span>
                    </div>
                    <span className="text-sm text-brand-dark/60">
                      {fechaHora(f.fecha)}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-brand-dark/70">
                    {f.consumidorFinal
                      ? "Consumidor final"
                      : f.razonSocial || "—"}
                    {f.cuit ? ` · CUIT ${f.cuit}` : ""} · de {f.remitoNumero}
                  </div>
                  <ul className="mt-2 border-t border-dashed border-brand-border pt-2 text-sm">
                    {f.items.map((it, i) => (
                      <li
                        key={i}
                        className="flex justify-between text-brand-dark/80"
                      >
                        <span>
                          {it.nombre}{" "}
                          <span className="text-brand-dark/50">
                            ({it.cantidad} × {formatARS(it.precioVenta)})
                          </span>
                        </span>
                        <span className="tabular-nums">
                          {formatARS(it.precioVenta * it.cantidad)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-brand-border pt-2">
                    <button
                      onClick={() => openFactura(f)}
                      className="rounded-lg bg-primary-light px-3 py-1.5 text-xs font-semibold text-primary"
                    >
                      🖨️ Ver / imprimir
                    </button>
                    <div className="text-right text-sm">
                      {f.tipo === "A" && (
                        <span className="mr-3 text-brand-dark/60">
                          Neto {formatARS(f.neto)} · IVA {formatARS(f.iva)}
                        </span>
                      )}
                      <span className="text-base font-extrabold text-brand-dark">
                        {formatARS(f.total)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
