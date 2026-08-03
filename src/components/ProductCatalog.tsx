"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useProducts } from "@/hooks/useProducts";
import { formatARS } from "@/lib/format";
import { precioVigente, estaEnOferta, precioDeCliente } from "@/lib/precios";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { consultaProductoLink } from "@/lib/order";
import { coincide } from "@/lib/search";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import type { Marca, Product } from "@/lib/types";

type MarcaFilter = "todos" | Marca;

const MARCA_TABS: { id: MarcaFilter; label: string; subtitle: string }[] = [
  { id: "todos",    label: "Todos",    subtitle: "Todo el catálogo" },
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
  const { user } = useAuth();
  const [agregado, setAgregado] = useState<string | null>(null);

  // Lista y descuento extra del cliente logueado. Un visitante sin login (o
  // cliente sin lista) ve el precio distribuidor.
  const markup = user?.markupLista;
  const descuento = user?.descuentoExtraPct;

  // Devuelve el producto con SU precio (lista + descuento del cliente) ya
  // aplicado a venta y oferta, para que la tarjeta y el carrito usen el mismo.
  const conPrecioDelCliente = (p: Product): Product => ({
    ...p,
    precioVenta: precioDeCliente(p.precioVenta, markup, descuento),
    precioOferta: p.precioOferta
      ? precioDeCliente(p.precioOferta, markup, descuento)
      : p.precioOferta,
  });

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

  // Orden del catálogo pedido por el cliente: primero algodones, después el
  // resto de Doncella (toallas, protectores…), y por último la línea Nonisec.
  const ordenProducto = (p: Product): number => {
    if (/algod/i.test(p.categoria)) return 0;
    if (p.marca === "nonisec") return 2;
    return 1; // resto de Doncella (femenina, bebé, etc.)
  };

  // Conteos por categoría (dependientes de marca activa), en el mismo orden.
  const catCounts = useMemo(() => {
    const filtered = all.filter(
      (p) => p.activo && (marca === "todos" ? true : p.marca === marca)
    );
    const m = new Map<string, number>();
    const prio = new Map<string, number>();
    filtered.forEach((p) => {
      m.set(p.categoria, (m.get(p.categoria) ?? 0) + 1);
      if (!prio.has(p.categoria)) prio.set(p.categoria, ordenProducto(p));
    });
    return Array.from(m.entries()).sort((a, b) => {
      const d = (prio.get(a[0]) ?? 1) - (prio.get(b[0]) ?? 1);
      return d !== 0 ? d : a[0].localeCompare(b[0]);
    });
  }, [marca, all]);

  const productos = useMemo(
    () =>
      all
        .filter((p) => p.activo)
        .filter((p) => (marca === "todos" ? true : p.marca === marca))
        .filter((p) => (cat === "Todas" ? true : p.categoria === cat))
        .filter((p) => {
          const t = q.trim();
          if (!t) return true;
          // Buscar también por CÓDIGO (pedido de Luciano) y por EAN.
          return (
            coincide(p.nombre, t) ||
            coincide(p.descripcion, t) ||
            (p.codigo ?? "").includes(t) ||
            (p.ean ?? "").includes(t)
          );
        })
        .sort((a, b) => {
          const d = ordenProducto(a) - ordenProducto(b);
          return d !== 0 ? d : a.categoria.localeCompare(b.categoria);
        }),
    [marca, cat, q, all]
  );

  const handleAdd = (p: Product) => {
    add(conPrecioDelCliente(p), 1);
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
      {/* === Filtros compactos: marca y categoría como desplegables + buscador.
             Antes eran dos filas grandes de botones (ocupaban mucho y a veces
             confundían); Luciano pidió menús desplegables. === */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-3">
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-brand-dark/55">
            Marca
            <select
              value={marca}
              onChange={(e) => {
                setMarca(e.target.value as MarcaFilter);
                setCat("Todas");
              }}
              className="rounded-lg border border-brand-border bg-surface px-3 py-2 text-sm font-medium normal-case text-brand-dark outline-none focus:border-primary"
            >
              {MARCA_TABS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({countByMarca[m.id]})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-brand-dark/55">
            Categoría
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              className="rounded-lg border border-brand-border bg-surface px-3 py-2 text-sm font-medium normal-case text-brand-dark outline-none focus:border-primary"
            >
              <option value="Todas">
                Todas ({catCounts.reduce((s, [, n]) => s + n, 0)})
              </option>
              {catCounts.map(([c, n]) => (
                <option key={c} value={c}>
                  {c} ({n})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-dark/40">
            🔎
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, código o descripción…"
            className="w-full rounded-full border border-brand-border bg-surface py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>
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
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-primary transition-colors group-hover:text-primary-dark">
                    {p.categoria}
                  </span>
                  {p.codigo && (
                    <span className="rounded-full bg-brand-dark px-2 py-0.5 text-[10px] font-bold text-white">
                      Cód {p.codigo}
                    </span>
                  )}
                </div>
                <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-tight text-brand-dark transition-colors group-hover:text-primary-dark">
                  {p.nombre}
                </h3>
                <p className="mt-1 line-clamp-2 flex-1 text-xs text-brand-dark/60">
                  {p.descripcion}
                </p>

                {p.precioVenta > 0 ? (
                  // El catálogo mostraba SIEMPRE el precio de lista, aunque el
                  // producto tuviera oferta: quedaba más caro acá que en el
                  // banner de promos. Ahora los dos muestran el vigente.
                  <p className="mt-2 flex items-baseline gap-2">
                    {estaEnOferta(p) && (
                      <span className="text-sm text-brand-dark/45 line-through">
                        {formatARS(precioDeCliente(p.precioVenta, markup, descuento))}
                      </span>
                    )}
                    <span className="text-lg font-bold text-primary">
                      {formatARS(precioVigente(conPrecioDelCliente(p)))}
                    </span>
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
                    <WhatsAppIcon className="h-5 w-5" />
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
