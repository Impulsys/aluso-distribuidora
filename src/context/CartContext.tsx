"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { CartItem, Product } from "@/lib/types";
import { precioVigente } from "@/lib/precios";

interface CartState {
  items: CartItem[];
  count: number;
  total: number;
  add: (p: Product, cantidad?: number) => void;
  setQty: (productId: string, cantidad: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartState | undefined>(undefined);
const STORAGE_KEY = "aluso_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const add: CartState["add"] = (p, cantidad = 1) => {
    setItems((prev) => {
      const ex = prev.find((i) => i.productId === p.id);
      if (ex) {
        return prev.map((i) =>
          i.productId === p.id
            ? { ...i, cantidad: i.cantidad + cantidad }
            : i
        );
      }
      return [
        ...prev,
        {
          productId: p.id,
          nombre: p.nombre,
          codigo: p.codigo,
          // OJO: acá iba `p.precioVenta`, y por eso la promo mostraba el precio
          // de oferta pero se cobraba el de lista. Tiene que ser el vigente.
          precioVenta: precioVigente(p),
          cantidad,
        },
      ];
    });
  };

  const setQty: CartState["setQty"] = (productId, cantidad) => {
    setItems((prev) =>
      cantidad <= 0
        ? prev.filter((i) => i.productId !== productId)
        : prev.map((i) =>
            i.productId === productId ? { ...i, cantidad } : i
          )
    );
  };

  const remove: CartState["remove"] = (productId) =>
    setItems((prev) => prev.filter((i) => i.productId !== productId));

  const clear = () => setItems([]);

  const count = items.reduce((n, i) => n + i.cantidad, 0);
  const total = items.reduce((s, i) => s + i.precioVenta * i.cantidad, 0);

  return (
    <CartContext.Provider
      value={{ items, count, total, add, setQty, remove, clear }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}
