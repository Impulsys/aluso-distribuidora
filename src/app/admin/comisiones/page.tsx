"use client";

import { useEffect, useMemo, useState } from "react";
import { getAllUsers } from "@/lib/admin";
import { subscribeRemitosRange, subscribeRemitosCobradosRange } from "@/lib/ventas";
import {
  DEFAULT_PRECIOS_CONFIG,
  subscribePreciosConfig,
} from "@/lib/preciosConfig";
import {
  calcularComisiones,
  type VendedorComision,
  type VentaVendedor,
} from "@/lib/comisiones";
import { formatARS, tsFromISO } from "@/lib/format";
import type { AppUser, Remito } from "@/lib/types";

function primerDiaMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function hoyISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export default function ComisionesPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [cfg, setCfg] = useState(DEFAULT_PRECIOS_CONFIG);
  const [desde, setDesde] = useState(primerDiaMes());
  const [hasta, setHasta] = useState(hoyISO());
  // Base de cálculo. "cobro" (real): comisiona lo COBRADO en el período — es la
  // regla de Anabela: si vendió a fin de mes y se cobró al mes siguiente, la
  // comisión cae al mes siguiente. "venta" (referencia): lo vendido, se cobre o
  // no — sirve para proyectar, pero NO es lo que se paga.
  const [base, setBase] = useState<"cobro" | "venta">("cobro");

  useEffect(() => {
    getAllUsers().then(setUsers).catch(() => {});
  }, []);
  useEffect(() => subscribePreciosConfig(setCfg), []);
  useEffect(() => {
    const start = tsFromISO(desde);
    const end = tsFromISO(hasta) + 86_400_000; // incluye el día "hasta"
    return base === "cobro"
      ? subscribeRemitosCobradosRange(start, end, setRemitos)
      : subscribeRemitosRange(start, end, setRemitos);
  }, [desde, hasta, base]);

  const resultado = useMemo(() => {
    const vendedores: VendedorComision[] = users
      .filter((u) => u.role === "vendedor")
      .map((u) => ({
        uid: u.uid,
        nombre: u.displayName,
        comisionPct: u.comisionPct,
        reclutadoPor: u.reclutadoPor,
      }));

    // Ventas atribuidas al VENDEDOR de la venta (el que se elige en el POS).
    // Si no se eligió vendedor, cae en createdBy. Las de la casa (sin vendedor)
    // no entran: no comisionan.
    const uidsVendedor = new Set(vendedores.map((v) => v.uid));
    const ventas: VentaVendedor[] = remitos
      .filter((r) => !r.anulado)
      .map((r) => ({ vendedorUid: r.vendedorUid || r.createdBy || "", monto: r.total }))
      .filter((v) => v.vendedorUid && uidsVendedor.has(v.vendedorUid));

    return calcularComisiones(vendedores, ventas, {
      comisionDefaultPct: cfg.comisionDefaultPct,
      overridePct: cfg.overridePct,
    });
  }, [users, remitos, cfg]);

  const totalAPagar = resultado.reduce((s, v) => s + v.total, 0);
  const totalVentas = resultado.reduce((s, v) => s + v.ventasPropias, 0);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 font-serif text-2xl font-medium text-brand-dark">
          <span className="text-3xl">💼</span> Comisiones
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-brand-dark/60">
          Lo que cobra cada vendedor, más el override de los vendedores que
          reclutó. Por defecto se paga sobre lo <b>cobrado</b> en el período (si
          se vendió a fin de mes y se cobró al siguiente, la comisión cae al
          siguiente). Las ventas de la casa (sin vendedor) no comisionan.
        </p>
      </div>

      {/* Base de cálculo: cobro (real) vs venta (referencia) */}
      <div className="mb-3 inline-flex rounded-xl border border-brand-border bg-surface p-1 text-sm">
        <button
          onClick={() => setBase("cobro")}
          className={`rounded-lg px-4 py-1.5 font-medium transition ${
            base === "cobro"
              ? "bg-primary text-white shadow-sm"
              : "text-brand-dark/60 hover:text-brand-dark"
          }`}
        >
          💰 Por cobro <span className="text-[11px] opacity-80">(se paga esto)</span>
        </button>
        <button
          onClick={() => setBase("venta")}
          className={`rounded-lg px-4 py-1.5 font-medium transition ${
            base === "venta"
              ? "bg-primary text-white shadow-sm"
              : "text-brand-dark/60 hover:text-brand-dark"
          }`}
        >
          📊 Por venta <span className="text-[11px] opacity-80">(referencia)</span>
        </button>
      </div>

      {/* Rango de fechas */}
      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-brand-border bg-surface p-4">
        <div>
          <label className="block text-[11px] font-bold uppercase text-brand-dark/55">
            {base === "cobro" ? "Cobrado desde" : "Vendido desde"}
          </label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="mt-1 rounded-lg border border-brand-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase text-brand-dark/55">
            {base === "cobro" ? "Cobrado hasta" : "Vendido hasta"}
          </label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="mt-1 rounded-lg border border-brand-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="ml-auto text-right">
          <p className="text-[11px] uppercase tracking-wider text-brand-dark/50">
            Total a pagar
          </p>
          <p className="font-serif text-2xl font-medium text-primary">
            {formatARS(totalAPagar)}
          </p>
          <p className="text-[11px] text-brand-dark/45">
            sobre {formatARS(totalVentas)} {base === "cobro" ? "cobrados" : "vendidos"}
          </p>
        </div>
      </div>

      {/* Detalle por vendedor */}
      {resultado.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-brand-border bg-surface p-8 text-center text-sm text-brand-dark/55">
          No hay vendedores cargados.
        </p>
      ) : (
        <div className="space-y-3">
          {resultado
            .slice()
            .sort((a, b) => b.total - a.total)
            .map((v) => (
              <article
                key={v.uid}
                className="rounded-2xl border border-brand-border bg-surface p-4 shadow-sm"
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-semibold text-brand-dark">{v.nombre}</h3>
                  <span className="font-serif text-xl font-medium text-primary">
                    {formatARS(v.total)}
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between text-brand-dark/70">
                    <span>
                      Ventas propias · comisión {v.comisionPct}%
                    </span>
                    <span>
                      {formatARS(v.ventasPropias)} →{" "}
                      <b className="text-brand-dark">
                        {formatARS(v.comisionPropia)}
                      </b>
                    </span>
                  </div>
                  {v.overridePorReclutado.map((o) => (
                    <div
                      key={o.reclutadoUid}
                      className="flex justify-between text-emerald-700"
                    >
                      <span>
                        Override sobre {o.reclutadoNombre} ({cfg.overridePct}%)
                      </span>
                      <span>
                        {formatARS(o.ventas)} →{" "}
                        <b>{formatARS(o.monto)}</b>
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
        </div>
      )}
    </div>
  );
}
