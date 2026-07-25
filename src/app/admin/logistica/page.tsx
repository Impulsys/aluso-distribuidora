"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useProducts } from "@/hooks/useProducts";
import { LOGISTICA_POR_EAN } from "@/data/logistica";
import {
  repartirFlete,
  type CriterioReparto,
  type LineaCarga,
} from "@/lib/logistica";
import { formatARS } from "@/lib/format";
import { coincide } from "@/lib/search";
import type { Product } from "@/lib/types";

const num = (v: string) => Math.max(0, Number(v) || 0);

export default function LogisticaPage() {
  const productos = useProducts();
  const [flete, setFlete] = useState(0);
  const [criterio, setCriterio] = useState<CriterioReparto>("volumen");
  const [bultos, setBultos] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");

  // Solo productos que tienen datos logísticos cargados (medidas/peso).
  const conDatos = useMemo(
    () => productos.filter((p) => p.ean && LOGISTICA_POR_EAN[p.ean]),
    [productos]
  );

  const filtrados = useMemo(() => {
    const t = q.trim();
    if (!t) return conDatos;
    return conDatos.filter(
      (p) => coincide(p.nombre, t) || coincide(p.ean ?? "", t)
    );
  }, [conDatos, q]);

  // Líneas de la carga (las que tienen al menos 1 bulto cargado).
  const lineas: LineaCarga[] = useMemo(() => {
    return conDatos
      .filter((p) => (bultos[p.ean!] ?? 0) > 0)
      .map((p) => {
        const d = LOGISTICA_POR_EAN[p.ean!];
        return {
          ean: p.ean!,
          nombre: p.nombre,
          bultos: bultos[p.ean!] ?? 0,
          m3Bulto: d.m3Bulto,
          pesoBultoKg: d.pesoBultoKg,
          paqPorBulto: d.paqPorBulto,
        };
      });
  }, [conDatos, bultos]);

  const resultado = useMemo(
    () => repartirFlete(flete, lineas, criterio),
    [flete, lineas, criterio]
  );

  const imgPorEan = useMemo(() => {
    const m = new Map<string, Product>();
    conDatos.forEach((p) => m.set(p.ean!, p));
    return m;
  }, [conDatos]);

  const totalBultos = lineas.reduce((s, l) => s + l.bultos, 0);
  const unidad = criterio === "volumen" ? "m³" : "kg";

  const setBulto = (ean: string, v: number) =>
    setBultos((prev) => ({ ...prev, [ean]: v }));

  return (
    <div className="mx-auto max-w-5xl">
      {/* Encabezado */}
      <div className="mb-6">
        <h1 className="flex items-center gap-2 font-serif text-2xl font-medium text-brand-dark">
          <span className="text-3xl">🚚</span> Calculadora de logística
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-brand-dark/60">
          Cargá el costo del flete y qué vino en la carga —aunque el palet venga
          mezclado— y repartimos el costo entre cada producto según lo que ocupa.
          Sirve para saber cuánto sumarle al costo de cada paquete.
        </p>
      </div>

      {/* Panel de control: flete + criterio */}
      <div className="mb-6 grid gap-4 rounded-2xl border border-brand-border bg-gradient-to-br from-primary-light/40 to-surface p-5 shadow-sm sm:grid-cols-[1fr_auto]">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">
            Costo del flete
          </label>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-serif text-2xl text-brand-dark/40">$</span>
            <input
              type="number"
              inputMode="numeric"
              value={flete || ""}
              onChange={(e) => setFlete(num(e.target.value))}
              placeholder="0"
              className="w-full bg-transparent font-serif text-3xl font-medium text-primary outline-none placeholder:text-brand-dark/25"
            />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">
            Repartir por
          </label>
          <div className="mt-1 inline-flex overflow-hidden rounded-xl border border-brand-border bg-surface p-1">
            {(["volumen", "peso"] as CriterioReparto[]).map((c) => (
              <button
                key={c}
                onClick={() => setCriterio(c)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${
                  criterio === c
                    ? "bg-primary text-white shadow-sm"
                    : "text-brand-dark/70 hover:bg-primary-light"
                }`}
              >
                {c === "volumen" ? "📦 Volumen" : "⚖️ Peso"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Resultado */}
      {lineas.length > 0 && flete > 0 && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-brand-border bg-surface shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border bg-primary-light/30 px-5 py-3">
            <p className="text-sm font-bold text-primary">
              Reparto del flete · {totalBultos} bulto
              {totalBultos === 1 ? "" : "s"} · {resultado.magnitudTotal} {unidad}{" "}
              en total
            </p>
            {resultado.sinRepartir !== 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                ⚠ Faltan medidas: {formatARS(resultado.sinRepartir)} sin repartir
              </span>
            )}
          </div>
          <div className="divide-y divide-brand-border">
            {resultado.lineas.map((l) => {
              const p = imgPorEan.get(l.ean);
              return (
                <div key={l.ean} className="flex items-center gap-3 px-5 py-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-brand-border">
                    {p?.imagen && (
                      <Image
                        src={p.imagen}
                        alt={l.nombre}
                        fill
                        sizes="48px"
                        className="object-contain p-1"
                        style={{ mixBlendMode: "multiply" }}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-brand-dark">
                      {l.nombre}
                    </p>
                    {/* Barra de proporción: cuánto del flete se lleva esta línea */}
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary-light">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${(l.proporcion * 100).toFixed(1)}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-[11px] font-semibold text-brand-dark/55">
                        {(l.proporcion * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-serif text-lg font-medium text-primary">
                      {formatARS(l.costoPorBulto)}
                    </p>
                    <p className="text-[11px] text-brand-dark/50">por bulto</p>
                    {l.costoPorPaquete > 0 && (
                      <p className="text-[11px] font-medium text-emerald-700">
                        {formatARS(l.costoPorPaquete)} / paquete
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selección de productos */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-brand-dark">
          ¿Qué vino en la carga?
        </h2>
        <div className="relative w-full sm:w-72">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-dark/40">
            🔎
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar producto…"
            className="w-full rounded-full border border-brand-border bg-surface py-2 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {filtrados.map((p) => {
          const b = bultos[p.ean!] ?? 0;
          const activo = b > 0;
          return (
            <div
              key={p.ean}
              className={`flex items-center gap-3 rounded-xl border p-2.5 transition ${
                activo
                  ? "border-primary bg-primary-light/25 shadow-sm"
                  : "border-brand-border bg-surface"
              }`}
            >
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-brand-border">
                {p.imagen && (
                  <Image
                    src={p.imagen}
                    alt={p.nombre}
                    fill
                    sizes="44px"
                    className="object-contain p-1"
                    style={{ mixBlendMode: "multiply" }}
                  />
                )}
              </div>
              <p className="min-w-0 flex-1 truncate text-xs font-medium text-brand-dark">
                {p.nombre}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setBulto(p.ean!, Math.max(0, b - 1))}
                  className="grid h-7 w-7 place-items-center rounded-lg bg-primary-light text-primary hover:bg-primary hover:text-white"
                  aria-label="Menos"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  value={b || ""}
                  onChange={(e) => setBulto(p.ean!, num(e.target.value))}
                  placeholder="0"
                  className="w-12 rounded-lg border border-brand-border bg-surface py-1 text-center text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={() => setBulto(p.ean!, b + 1)}
                  className="grid h-7 w-7 place-items-center rounded-lg bg-primary-light text-primary hover:bg-primary hover:text-white"
                  aria-label="Más"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {conDatos.length === 0 && (
        <p className="rounded-xl border border-dashed border-brand-border bg-surface p-8 text-center text-sm text-brand-dark/55">
          Todavía no hay productos con medidas cargadas.
        </p>
      )}
    </div>
  );
}
