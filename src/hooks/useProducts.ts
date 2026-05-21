"use client";

import { useEffect, useMemo, useState } from "react";
import { PRODUCTOS_SEED } from "@/data/productos";
import {
  subscribeProductOverrides,
  type ProductOverride,
} from "@/lib/admin";
import type { Product } from "@/lib/types";

/**
 * Devuelve la lista de productos = seed estático mezclado con overrides
 * editables vivos desde Firestore (precio, stock, destacado, oferta).
 * Solo subscribe una vez; comparte el estado por contexto del hook.
 */
export function useProducts(): Product[] {
  const [overrides, setOverrides] = useState<Record<string, ProductOverride>>(
    {}
  );

  useEffect(() => {
    const unsub = subscribeProductOverrides(setOverrides);
    return unsub;
  }, []);

  return useMemo(
    () =>
      PRODUCTOS_SEED.map((p) => {
        const o = overrides[p.id];
        return o ? { ...p, ...o } : p;
      }),
    [overrides]
  );
}
