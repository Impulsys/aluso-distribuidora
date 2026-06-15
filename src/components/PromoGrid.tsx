"use client";

import { useEffect, useMemo, useState } from "react";
import { useProducts } from "@/hooks/useProducts";
import { useCart } from "@/context/CartContext";
import { subscribePromos } from "@/lib/promos";
import { consultaProductoLink } from "@/lib/order";
import PromoBanner from "./PromoBanner";
import type { Product, Promocion } from "@/lib/types";

const SLOTS = 4; // grilla fija 2×2

/** Placeholder con el logo de la distribuidora para los cuadrantes vacíos. */
function Placeholder() {
  return (
    <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-brand-border bg-surface/60 p-4 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-secondary text-xl font-bold text-primary">
        LA
      </span>
      <p className="text-sm font-medium text-brand-dark/50">
        Distribuidora Los Amigos
      </p>
      <p className="text-xs text-brand-dark/35">Espacio para promoción</p>
    </div>
  );
}

export default function PromoGrid() {
  const productos = useProducts();
  const { add } = useCart();
  const [promos, setPromos] = useState<Promocion[]>([]);
  const [agregadoId, setAgregadoId] = useState<string | null>(null);

  useEffect(() => subscribePromos(setPromos), []);

  const byId = useMemo(() => {
    const m = new Map<string, Product>();
    productos.forEach((p) => m.set(p.id, p));
    return m;
  }, [productos]);

  // Promos activas con producto válido (hasta 4).
  const slides = useMemo(
    () =>
      promos
        .filter((p) => p.activo)
        .map((p) => ({ promo: p, product: byId.get(p.productId) }))
        .filter((s) => s.product && s.product.activo)
        .slice(0, SLOTS),
    [promos, byId]
  );

  if (slides.length === 0) return null;

  const handleAdd = (promo: Promocion, product?: Product) => {
    if (!product) return;
    add(product, 1);
    setAgregadoId(promo.id);
    setTimeout(() => setAgregadoId((c) => (c === promo.id ? null : c)), 1200);
  };

  // Completa con placeholders hasta llegar a 4 cuadrantes.
  const vacios = Math.max(0, SLOTS - slides.length);

  return (
    <section className="mb-6 grid gap-4 sm:grid-cols-2">
      {slides.map((s) => (
        <PromoBanner
          key={s.promo.id}
          promo={s.promo}
          product={s.product}
          regalo={
            s.promo.regaloProductId ? byId.get(s.promo.regaloProductId) : undefined
          }
          onAdd={() => handleAdd(s.promo, s.product)}
          consultaHref={s.product ? consultaProductoLink(s.product) : undefined}
          agregado={agregadoId === s.promo.id}
        />
      ))}
      {Array.from({ length: vacios }).map((_, i) => (
        <Placeholder key={`ph-${i}`} />
      ))}
    </section>
  );
}
