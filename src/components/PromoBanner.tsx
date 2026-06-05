"use client";

import Image from "next/image";
import { getPaleta } from "@/lib/promos";
import { formatARS } from "@/lib/format";
import type { Product, Promocion } from "@/lib/types";

interface Props {
  promo: Pick<
    Promocion,
    "badge" | "titulo" | "texto" | "paleta" | "mostrarPrecio"
  >;
  product?: Product;
  /** Si se pasa, el botón "Agregar" funciona; si no, es vista previa. */
  onAdd?: () => void;
  consultaHref?: string;
  agregado?: boolean;
}

/**
 * Banner promocional de ancho completo: imagen a la izquierda, texto a la
 * derecha, sobre la paleta elegida. Se usa en el carrusel y en la vista previa.
 */
export default function PromoBanner({
  promo,
  product,
  onAdd,
  consultaHref,
  agregado,
}: Props) {
  const paleta = getPaleta(promo.paleta);
  const titulo = (promo.titulo?.trim() || product?.nombre) ?? "Producto";
  const enOferta =
    !!product &&
    (product.precioOferta ?? 0) > 0 &&
    (product.precioOferta ?? 0) < product.precioVenta;

  return (
    <div
      className="relative flex min-h-[230px] items-center gap-5 overflow-hidden rounded-3xl p-5 text-white shadow-xl sm:gap-8 sm:p-8"
      style={{ background: paleta.bg }}
    >
      {/* Brillo decorativo */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-2xl" />

      {/* Imagen */}
      <div className="relative z-10 grid aspect-square w-28 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white shadow-lg sm:w-44 md:w-52">
        {product ? (
          <Image
            src={product.imagen}
            alt={titulo}
            width={300}
            height={300}
            className="h-full w-full object-contain p-3"
          />
        ) : (
          <span className="text-xs text-slate-400">Sin producto</span>
        )}
      </div>

      {/* Texto */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {promo.badge.trim() && (
          <span
            className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-extrabold uppercase tracking-wide shadow-sm"
            style={{ color: paleta.acento }}
          >
            ★ {promo.badge.trim()}
          </span>
        )}

        <h3 className="font-serif text-xl font-bold leading-tight drop-shadow-sm sm:text-3xl">
          {titulo}
        </h3>

        {promo.texto.trim() && (
          <p className="mt-1 line-clamp-3 max-w-2xl text-sm text-white/90 sm:mt-2 sm:text-base">
            {promo.texto.trim()}
          </p>
        )}

        {promo.mostrarPrecio && product && product.precioVenta > 0 && (
          <p className="mt-2 flex items-baseline gap-2">
            {enOferta && (
              <span className="text-sm text-white/60 line-through sm:text-base">
                {formatARS(product.precioVenta)}
              </span>
            )}
            <span className="text-2xl font-extrabold drop-shadow-sm sm:text-4xl">
              {formatARS(enOferta ? product.precioOferta! : product.precioVenta)}
            </span>
          </p>
        )}

        <div className="mt-3 flex items-center gap-2 sm:mt-4">
          <button
            type="button"
            onClick={onAdd}
            disabled={!onAdd}
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold shadow-md transition hover:scale-[1.03] disabled:cursor-default disabled:hover:scale-100"
            style={{ color: paleta.acento }}
          >
            {agregado ? "✓ Agregado" : "Agregar"}
          </button>
          {consultaHref ? (
            <a
              href={consultaHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Consultar por WhatsApp"
              title="Consultar por WhatsApp"
              className="grid h-11 w-11 place-items-center rounded-xl bg-[#25D366] text-lg text-white shadow-md transition hover:scale-[1.03]"
            >
              💬
            </a>
          ) : (
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#25D366] text-lg text-white shadow-md">
              💬
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
