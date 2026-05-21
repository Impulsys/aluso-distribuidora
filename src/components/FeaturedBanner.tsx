"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useProducts } from "@/hooks/useProducts";
import { useCart } from "@/context/CartContext";
import { consultaProductoLink } from "@/lib/order";
import { formatARS } from "@/lib/format";
import { MARCAS, type Product } from "@/lib/types";

export default function FeaturedBanner() {
  const all = useProducts();
  const { add } = useCart();
  const [agregado, setAgregado] = useState<string | null>(null);

  const destacados = useMemo<Product[]>(
    () => all.filter((p) => p.activo && p.destacado).slice(0, 3),
    [all]
  );

  if (destacados.length === 0) return null;

  const handleAdd = (p: Product) => {
    add(p, 1);
    setAgregado(p.id);
    setTimeout(() => setAgregado((c) => (c === p.id ? null : c)), 1200);
  };

  const cols =
    destacados.length === 1
      ? "grid-cols-1 max-w-3xl mx-auto"
      : destacados.length === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center gap-3">
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
          ⭐ Destacados
        </span>
        <span className="text-sm text-brand-dark/60">
          {destacados.length === 1
            ? "Producto destacado del mes"
            : `${destacados.length} ofertas seleccionadas`}
        </span>
      </div>

      <div className={`grid gap-4 ${cols}`}>
        {destacados.map((p) => {
          const enOferta =
            !!p.precioOferta &&
            p.precioOferta > 0 &&
            p.precioOferta < p.precioVenta;
          return (
            <article
              key={p.id}
              className="relative flex overflow-hidden rounded-2xl border border-brand-border bg-gradient-to-br from-primary-light to-surface shadow-md transition hover:shadow-lg"
            >
              {enOferta && (
                <span className="absolute right-3 top-3 z-10 rounded-full bg-accent px-3 py-1 text-xs font-bold text-white shadow">
                  OFERTA
                </span>
              )}

              <div className="relative aspect-square w-2/5 min-w-[140px] bg-white">
                <Image
                  src={p.imagen}
                  alt={p.nombre}
                  fill
                  sizes="(max-width:640px) 40vw, 25vw"
                  className="object-contain p-3"
                />
              </div>

              <div className="flex flex-1 flex-col p-3 sm:p-4">
                <span className="inline-block w-fit rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                  {MARCAS[p.marca]}
                </span>
                <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-tight text-brand-dark sm:text-base">
                  {p.nombre}
                </h3>
                <p className="mt-1 line-clamp-2 flex-1 text-xs text-brand-dark/60">
                  {p.descripcion}
                </p>

                {p.precioVenta > 0 ? (
                  enOferta ? (
                    <p className="mt-2">
                      <span className="text-sm text-brand-dark/50 line-through">
                        {formatARS(p.precioVenta)}
                      </span>
                      <span className="ml-2 text-lg font-extrabold text-accent">
                        {formatARS(p.precioOferta!)}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-2 text-lg font-extrabold text-primary">
                      {formatARS(p.precioVenta)}
                    </p>
                  )
                ) : (
                  <p className="mt-2 text-sm font-semibold text-brand-dark/60">
                    Consultar precio
                  </p>
                )}

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleAdd(p)}
                    className="flex-1 rounded-lg bg-primary px-2 py-2 text-xs font-semibold text-white transition hover:bg-primary-dark"
                  >
                    {agregado === p.id ? "✓ Agregado" : "Agregar"}
                  </button>
                  <a
                    href={consultaProductoLink(p)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Consultar por WhatsApp"
                    className="grid place-items-center rounded-lg bg-[#25D366] px-3 text-white"
                    title="Consultar por WhatsApp"
                  >
                    💬
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
