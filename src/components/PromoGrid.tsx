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
      {/* Decía "LA", las iniciales de Los Amigos, el OTRO cliente — y se veía
          en el catálogo público cada vez que había menos de 4 promos activas. */}
      <span className="grid h-16 w-16 place-items-center rounded-full bg-secondary text-xl font-bold text-primary">
        AD
      </span>
      <p className="text-sm font-medium text-brand-dark/50">
        ALUSO DISTRIBUIDORA
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
        .map((p) => {
          // El regalo se resuelve acá y se valida como el principal: si se dio
          // de baja o se desactivó, la promo se muestra SIN regalo en vez de
          // seguir prometiendo un combo que el carrito no puede armar.
          const regaloCrudo = p.regaloProductId ? byId.get(p.regaloProductId) : undefined;
          return {
            promo: p,
            product: byId.get(p.productId),
            regalo: regaloCrudo?.activo ? regaloCrudo : undefined,
          };
        })
        .filter((s) => s.product && s.product.activo)
        .slice(0, SLOTS),
    [promos, byId]
  );

  if (slides.length === 0) return null;

  const handleAdd = (promo: Promocion, product?: Product, regalo?: Product) => {
    if (!product) return;

    // Antes esto era `add(product, 1)`: la promo decía "llevá 3 y 1 de regalo",
    // el cliente tocaba Agregar y le quedaba UNA unidad suelta a precio de
    // lista, sin regalo. El combo era puramente decorativo.
    const lleva = promo.cantidadLleva && promo.cantidadLleva > 0 ? promo.cantidadLleva : 1;
    add(product, lleva);

    // El regalo se agrega solo si el producto sigue existiendo y activo: si se
    // dio de baja, se agrega el principal igual y no se promete algo que no hay.
    if (promo.regaloProductId && regalo?.activo) {
      const cant = promo.cantidadRegalo && promo.cantidadRegalo > 0 ? promo.cantidadRegalo : 1;
      // Precio 0: es regalo. El remito lo muestra como entregado sin cargo.
      add({ ...regalo, precioVenta: 0, precioOferta: 0 }, cant);
    }

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
          regalo={s.regalo}
          onAdd={() => handleAdd(s.promo, s.product, s.regalo)}
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

