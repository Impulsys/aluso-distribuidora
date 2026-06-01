"use client";

import { useEffect, useMemo, useState } from "react";
import { PRODUCTOS_SEED } from "@/data/productos";
import {
  subscribeProductOverrides,
  type ProductOverride,
} from "@/lib/admin";
import type { Product } from "@/lib/types";

const SEED_IDS = new Set(PRODUCTOS_SEED.map((p) => p.id));

/**
 * Lista de productos = seed estático mezclado con overrides vivos de Firestore
 * (precio, stock, destacado, oferta) + los productos NUEVOS creados en Firestore
 * (los que no están en el seed), p.ej. desde la recepción de mercadería.
 */
export function useProducts(): Product[] {
  // Los docs de products pueden ser overrides parciales (productos del seed)
  // o productos completos (los nuevos). Tipamos como Partial<Product>.
  const [overrides, setOverrides] = useState<
    Record<string, ProductOverride & Partial<Product>>
  >({});

  useEffect(() => {
    const unsub = subscribeProductOverrides(
      setOverrides as (o: Record<string, ProductOverride>) => void
    );
    return unsub;
  }, []);

  return useMemo(() => {
    // 1) Seed + override
    const fromSeed = PRODUCTOS_SEED.map((p) => {
      const o = overrides[p.id];
      return o ? { ...p, ...o } : p;
    });

    // 2) Productos nuevos (docs de Firestore que no están en el seed)
    const nuevos: Product[] = Object.entries(overrides)
      .filter(([id]) => !SEED_IDS.has(id))
      .map(([id, d]) => ({
        id,
        ean: d.ean,
        marca: d.marca ?? "nonisec",
        nombre: d.nombre ?? "(sin nombre)",
        descripcion: d.descripcion ?? "",
        imagen:
          d.imagen ?? "https://placehold.co/600x600/006081/ffffff?text=Producto",
        precioVenta: d.precioVenta ?? 0,
        precioCosto: 0, // el costo real vive en productCosts
        stock: d.stock ?? 0,
        categoria: d.categoria ?? "General",
        activo: d.activo ?? true,
        destacado: d.destacado,
        precioOferta: d.precioOferta,
      }));

    return [...fromSeed, ...nuevos];
  }, [overrides]);
}
