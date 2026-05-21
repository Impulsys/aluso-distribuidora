"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useProducts } from "@/hooks/useProducts";
import { formatARS } from "@/lib/format";
import { useCart } from "@/context/CartContext";
import { consultaProductoLink } from "@/lib/order";
import type { Marca, Product } from "@/lib/types";

type MarcaFilter = "todos" | Marca;

const MARCA_TABS: { id: MarcaFilter; label: string; subtitle: string }[] = [
  { id: "todos",    label: "Todos",    subtitle: "82 productos" },
  { id: "doncella", label: "Doncella", subtitle: "Femenina · bebé · algodón" },
  { id: "nonisec",  label: "Nonisec",  subtitle: "Incontinencia adulta" },
];

export default function ProductCatalog() {
  const sp = useSearchParams();
  const all = useProducts(); // seed + overrides en vivo de Firestore
  const [marca, setMarca] = useState<MarcaFilter>("todos");
  const [cat, setCat] = useState<string>("Todas");
  const [q, setQ] = useState("");
  const { add } = useCart();
  const [agregado, setAgregado] = useState<string | null>(null);

  // Lee filtros del URL al montar (deep linking desde la landing)
  useEffect(() => {
    const m = sp.get("marca");
    const c = sp.get("cat");
    if (m === "doncella" || m === "nonisec" || m === "todos") setMarca(m);
    if (c) setCat(c);
  }, [sp]);

  // Conteos por marca para los tabs
  const countByMarca = useMemo(() => {
    const active = all.filter((p) => p.activo);
    return {
      todos: active.length,
      doncella: active.filter((p) => p.marca === "doncella").length,
      nonisec: active.filter((p) => p.marca === "nonisec").length,
    } as Record<MarcaFilter, number>;
  }, [all]);

  // Conteos por categoría (dependientes de marca activa)
  const catCounts = useMemo(() => {
    const filtered = all.filter(
      (p) => p.activo && (marca === "todos" ? true : p.marca === marca)
    );
    const m = new Map<string, number>();
    filtered.forEach((p) => m.set(p.categoria, (m.get(p.categoria) ?? 0) + 1));
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [marca, all]);

  const productos = useMemo(
    () =>
      all
        .filter((p) => p.activo)
        .filter((p) => (marca === "todos" ? true : p.marca === marca))
        .filter((p) => (cat === "Todas" ? true : p.categoria === cat))
        .filter((p) => {
          if (!q.trim()) return true;
          const t = q.toLowerCase();
          return (
            p.nombre.toLowerCase().includes(t) ||
            p.descripcion.toLowerCase().includes(t)
          );
        }),
    [marca, cat, q, all]
  );

  const handleAdd = (p: Product) => {
    add(p, 1);
    setAgregado(p.id);
    setTimeout(() => setAgregado((c) => (c === p.id ? null : c)), 1200);
  };

  // Color de la chip por marca
  const marcaChip = (m: Marca) =>
    m === "doncella"
      ? "bg-rose-600"
      : m === "nonisec"
      ? "bg-sky-700"
      : "bg-primary";

  return (
    <>
      {/* === Marca tabs (estilo segmento grande) === */}
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-full overflow-hidden rounded-2xl border border-brand-border bg-surface p-1 shadow-sm sm:w-auto">
          {MARCA_TABS.map((m) => {
            const active = marca === m.id;
            return (
              <button
                key={m.id}
                onClick={() => {
                  setMarca(m.id);
                  setCat("Todas");
                }}
                className={`flex flex-1 flex-col items-start gap-0.5 rounded-xl px-4 py-2.5 text-left transition sm:flex-none ${
                  active
                    ? "bg-primary text-white shadow-md"
                    : "text-brand-dark hover:bg-primary-light"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-bold leading-tight">
                  {m.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-primary-light text-primary"
                    }`}
                  >
                    {countByMarca[m.id]}
                  </span>
                </span>
                <span
                  className={`text-[11px] ${
                    active ? "text-white/75" : "text-brand-dark/55"
                  }`}
                >
                  {m.subtitle}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative w-full sm:w-80">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-dark/40">
            🔎
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o descripción…"
            className="w-full rounded-full border border-brand-border bg-surface py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>
      </div>

      {/* === Categorías como pills con conteo === */}
      <div className="mb-6 -mx-2 flex flex-wrap gap-2 px-2">
        <button
          onClick={() => setCat("Todas")}
          className={`group inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
            cat === "Todas"
              ? "bg-primary text-white shadow-sm"
              : "border border-brand-border bg-surface text-brand-dark hover:border-primary hover:text-primary"
          }`}
        >
          Todas
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              cat === "Todas"
                ? "bg-white/20 text-white"
                : "bg-primary-light text-primary group-hover:bg-primary group-hover:text-white"
            }`}
          >
            {catCounts.reduce((s, [, n]) => s + n, 0)}
          </span>
        </button>
        {catCounts.map(([c, n]) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`group inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              cat === c
                ? "bg-primary text-white shadow-sm"
                : "border border-brand-border bg-surface text-brand-dark hover:border-primary hover:text-primary"
            }`}
          >
            {c}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                cat === c
                  ? "bg-white/20 text-white"
                  : "bg-primary-light text-primary group-hover:bg-primary group-hover:text-white"
              }`}
            >
              {n}
            </span>
          </button>
        ))}
      </div>

      <p className="mb-4 text-sm text-brand-dark/60">
        {productos.length} producto{productos.length === 1 ? "" : "s"}
        {cat !== "Todas" && <> en <b className="text-brand-dark">{cat}</b></>}
        {q.trim() && <> que coinciden con <b className="text-brand-dark">"{q}"</b></>}
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {productos.map((p) => {
          const bg =
            p.marca === "doncella"
              ? "bg-gradient-to-br from-rose-50 via-white to-rose-100"
              : p.marca === "nonisec"
              ? "bg-gradient-to-br from-sky-50 via-white to-sky-100"
              : "bg-primary-light";
          const ringHover =
            p.marca === "doncella"
              ? "hover:ring-rose-300"
              : "hover:ring-sky-300";
          const isAdded = agregado === p.id;
          return (
            <article
              key={p.id}
              className={`group relative flex flex-col overflow-hidden rounded-xl bg-surface shadow-sm ring-1 ring-brand-border transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl ${ringHover}`}
            >
              {/* === Image area === */}
              <div className={`relative aspect-square overflow-hidden ${bg}`}>
                <Image
                  src={p.imagen}
                  alt={p.nombre}
                  fill
                  sizes="(max-width:640px) 50vw, 25vw"
                  className="object-contain p-2 transition-transform duration-500 ease-out group-hover:scale-110"
                />
                {/* Shine sweep en hover */}
                <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent skew-x-12 transition-transform duration-700 ease-out group-hover:translate-x-full" />
                {/* Chip marca */}
                <span
                  className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white shadow transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg ${marcaChip(p.marca)}`}
                >
                  {p.marca}
                </span>
              </div>

              {/* === Content === */}
              <div className="flex flex-1 flex-col p-3">
                <span className="text-[10px] font-medium uppercase tracking-wide text-primary transition-colors group-hover:text-primary-dark">
                  {p.categoria}
                </span>
                <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-tight text-brand-dark transition-colors group-hover:text-primary-dark">
                  {p.nombre}
                </h3>
                <p className="mt-1 line-clamp-2 flex-1 text-xs text-brand-dark/60">
                  {p.descripcion}
                </p>

                {p.precioVenta > 0 ? (
                  <p className="mt-2 text-lg font-bold text-primary">
                    {formatARS(p.precioVenta)}
                  </p>
                ) : (
                  <p className="mt-2 text-sm font-semibold text-brand-dark/60">
                    Consultar precio
                  </p>
                )}

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleAdd(p)}
                    className={`flex-1 rounded-lg bg-gradient-to-br from-primary to-primary-dark px-2 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:shadow-md hover:brightness-110 active:scale-95 ${
                      isAdded ? "from-emerald-500 to-emerald-700" : ""
                    }`}
                  >
                    {isAdded ? "✓ Agregado" : "Agregar"}
                  </button>
                  <a
                    href={consultaProductoLink(p)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Consultar por WhatsApp"
                    className="grid place-items-center rounded-lg bg-[#25D366] px-3 text-white shadow-sm transition-transform duration-200 hover:rotate-6 hover:scale-110"
                    title="Consultar por WhatsApp"
                  >
                    💬
                  </a>
                </div>
              </div>

              {/* === Barra inferior animada del color de marca === */}
              <div
                className={`absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 transition-transform duration-500 ease-out group-hover:scale-x-100 ${
                  p.marca === "doncella" ? "bg-rose-500" : "bg-sky-600"
                }`}
              />
            </article>
          );
        })}
      </div>
    </>
  );
}
