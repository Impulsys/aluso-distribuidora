"use client";

import { useMemo } from "react";
import { useProducts } from "@/hooks/useProducts";
import { LOGISTICA_POR_EAN } from "@/data/logistica";

/** Unidades por bulto del producto (1 si no hay dato). */
const paqDe = (ean?: string) => LOGISTICA_POR_EAN[ean ?? ""]?.paqPorBulto || 1;

/**
 * Pedido al proveedor: lista TODO lo que quedó en stock NEGATIVO por vender en
 * backorder (sin stock). Es lo que hay que reponer. Cuando llega la mercadería
 * se carga en "Ctas proveedores → Registrar compra" y el stock se corrige solo.
 */
export default function PedidoProveedorPage() {
  const productos = useProducts();

  const faltantes = useMemo(
    () =>
      productos
        .filter((p) => (p.stock ?? 0) < 0)
        .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0)),
    [productos]
  );

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-serif text-2xl text-brand-dark">
          Pedido al proveedor
        </h2>
        <p className="text-sm text-brand-dark/60">
          Productos con stock <b>negativo</b> (se vendieron sin stock). Esto es
          lo que hay que reponer. Al recibir la mercadería, cargala en{" "}
          <b>Ctas proveedores → Registrar compra</b> y el stock se corrige solo.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-brand-border bg-surface">
        <div className="hidden grid-cols-[1fr_110px_110px_110px] gap-3 border-b border-brand-border bg-primary-light px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-primary md:grid">
          <span>Producto</span>
          <span className="text-right">Faltan (u.)</span>
          <span className="text-right">Faltan (bultos)</span>
          <span className="text-right">Stock</span>
        </div>

        {faltantes.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-brand-dark/50">
            No hay faltantes. Todo el stock está en cero o positivo. 👍
          </p>
        ) : (
          <ul className="divide-y divide-brand-border">
            {faltantes.map((p) => {
              const paq = paqDe(p.ean);
              const faltanU = -(p.stock ?? 0);
              const faltanBultos = Math.ceil(faltanU / paq);
              return (
                <li
                  key={p.id}
                  className="grid grid-cols-1 gap-1 px-4 py-3 text-sm md:grid-cols-[1fr_110px_110px_110px] md:gap-3"
                >
                  <div>
                    <span className="font-medium text-brand-dark">
                      {p.nombre}
                    </span>
                    {p.codigo && (
                      <span className="ml-2 text-[11px] text-brand-dark/45">
                        {p.codigo}
                      </span>
                    )}
                  </div>
                  <div className="text-right font-bold tabular-nums text-red-600">
                    {faltanU}
                  </div>
                  <div className="text-right tabular-nums text-brand-dark/70">
                    {paq > 1 ? `${faltanBultos}` : "—"}
                  </div>
                  <div className="text-right font-bold tabular-nums text-red-600">
                    {p.stock}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {faltantes.length > 0 && (
        <p className="mt-3 text-sm text-brand-dark/55">
          {faltantes.length} producto{faltantes.length === 1 ? "" : "s"} para
          reponer.
        </p>
      )}
    </div>
  );
}
