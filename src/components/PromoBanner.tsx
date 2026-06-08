"use client";

import Image from "next/image";
import { getPaleta } from "@/lib/promos";
import { formatARS } from "@/lib/format";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import type { Product, Promocion } from "@/lib/types";

interface Props {
  promo: Pick<
    Promocion,
    | "badge"
    | "titulo"
    | "texto"
    | "paleta"
    | "mostrarPrecio"
    | "cantidadLleva"
    | "cantidadRegalo"
  >;
  product?: Product;
  /** Producto de regalo de la oferta combinada (opcional). */
  regalo?: Product;
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
  regalo,
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
  const cantLleva = promo.cantidadLleva && promo.cantidadLleva > 0 ? promo.cantidadLleva : 0;
  const cantRegalo = promo.cantidadRegalo && promo.cantidadRegalo > 0 ? promo.cantidadRegalo : 1;

  return (
    <div
      className="relative flex min-h-[230px] items-center gap-5 overflow-hidden rounded-3xl p-5 text-white shadow-xl sm:gap-8 sm:p-8"
      style={{ background: paleta.bg }}
    >
      {/* Brillo decorativo */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-2xl" />

      {/* Imágenes: principal (+ regalo si la oferta es combinada) */}
      <div className="relative z-10 flex shrink-0 items-center gap-2 sm:gap-3">
        {/* Principal */}
        <div
          className={`relative grid aspect-square place-items-center overflow-hidden rounded-2xl bg-white shadow-lg ${
            regalo ? "w-24 sm:w-36" : "w-28 sm:w-44 md:w-52"
          }`}
        >
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
          {cantLleva > 0 && (
            <span
              className="absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-xs font-extrabold text-white shadow"
              style={{ background: paleta.acento }}
            >
              ×{cantLleva}
            </span>
          )}
        </div>

        {/* Regalo (opcional) */}
        {regalo && (
          <>
            <span className="text-2xl font-black text-white/90 drop-shadow sm:text-3xl">
              +
            </span>
            <div className="relative grid aspect-square w-20 place-items-center overflow-hidden rounded-2xl bg-white shadow-lg sm:w-28">
              <Image
                src={regalo.imagen}
                alt={regalo.nombre}
                width={220}
                height={220}
                className="h-full w-full object-contain p-2"
              />
              <span className="absolute left-0 right-0 top-0 bg-emerald-500 py-0.5 text-center text-[9px] font-extrabold uppercase tracking-wide text-white">
                🎁 Regalo
              </span>
              <span className="absolute bottom-1.5 right-1.5 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-extrabold text-white shadow">
                ×{cantRegalo}
              </span>
            </div>
          </>
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
              className="grid h-11 w-11 place-items-center rounded-xl bg-[#25D366] text-white shadow-md transition hover:scale-[1.03]"
            >
              <WhatsAppIcon className="h-6 w-6" />
            </a>
          ) : (
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#25D366] text-white shadow-md">
              <WhatsAppIcon className="h-6 w-6" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
