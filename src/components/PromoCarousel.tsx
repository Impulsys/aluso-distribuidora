"use client";

import { useEffect, useMemo, useState } from "react";
import { useProducts } from "@/hooks/useProducts";
import { useCart } from "@/context/CartContext";
import { subscribePromos } from "@/lib/promos";
import { consultaProductoLink } from "@/lib/order";
import PromoBanner from "./PromoBanner";
import type { Product, Promocion } from "@/lib/types";

const INTERVALO = 6000; // ms entre slides

export default function PromoCarousel() {
  const productos = useProducts();
  const { add } = useCart();
  const [promos, setPromos] = useState<Promocion[]>([]);
  const [idx, setIdx] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [agregado, setAgregado] = useState(false);

  useEffect(() => subscribePromos(setPromos), []);

  const byId = useMemo(() => {
    const m = new Map<string, Product>();
    productos.forEach((p) => m.set(p.id, p));
    return m;
  }, [productos]);

  // Solo promos activas cuyo producto existe y está activo.
  const slides = useMemo(
    () =>
      promos
        .filter((p) => p.activo)
        .map((p) => ({ promo: p, product: byId.get(p.productId) }))
        .filter((s) => s.product && s.product.activo),
    [promos, byId]
  );

  // Mantener el índice dentro de rango cuando cambian los slides.
  useEffect(() => {
    if (idx >= slides.length) setIdx(0);
  }, [slides.length, idx]);

  // Auto-avance.
  useEffect(() => {
    if (pausado || slides.length <= 1) return;
    const t = setInterval(
      () => setIdx((i) => (i + 1) % slides.length),
      INTERVALO
    );
    return () => clearInterval(t);
  }, [pausado, slides.length]);

  // Reset del "Agregado" al cambiar de slide.
  useEffect(() => setAgregado(false), [idx]);

  if (slides.length === 0) return null;
  const actual = slides[Math.min(idx, slides.length - 1)];

  const ir = (i: number) => setIdx((i + slides.length) % slides.length);

  const handleAdd = () => {
    if (!actual.product) return;
    add(actual.product, 1);
    setAgregado(true);
    setTimeout(() => setAgregado(false), 1200);
  };

  return (
    <section
      className="mb-6"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      <div className="relative">
        <PromoBanner
          promo={actual.promo}
          product={actual.product}
          regalo={
            actual.promo.regaloProductId
              ? byId.get(actual.promo.regaloProductId)
              : undefined
          }
          onAdd={handleAdd}
          consultaHref={
            actual.product ? consultaProductoLink(actual.product) : undefined
          }
          agregado={agregado}
        />

        {slides.length > 1 && (
          <>
            {/* Flechas */}
            <button
              onClick={() => ir(idx - 1)}
              aria-label="Anterior"
              className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/30 text-white backdrop-blur transition hover:bg-white/50"
            >
              ‹
            </button>
            <button
              onClick={() => ir(idx + 1)}
              aria-label="Siguiente"
              className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/30 text-white backdrop-blur transition hover:bg-white/50"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* Puntos */}
      {slides.length > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          {slides.map((s, i) => (
            <button
              key={s.promo.id}
              onClick={() => ir(i)}
              aria-label={`Ir a la promoción ${i + 1}`}
              className={`h-2.5 rounded-full transition-all ${
                i === idx ? "w-6 bg-primary" : "w-2.5 bg-brand-dark/25"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
