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
 * Banner promocional de ancho completo. Estructura:
 *   cartel + título (arriba) · productos + precio/acciones (medio) ·
 *   descripción a todo el ancho (abajo). Se usa en el carrusel y la vista previa.
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
  const cantLleva =
    promo.cantidadLleva && promo.cantidadLleva > 0 ? promo.cantidadLleva : 0;
  const cantRegalo =
    promo.cantidadRegalo && promo.cantidadRegalo > 0 ? promo.cantidadRegalo : 1;

  return (
    <div
      className="relative min-h-[220px] overflow-hidden rounded-3xl p-5 text-white shadow-xl sm:p-7"
      style={{ background: paleta.bg }}
    >
      {/* Brillos decorativos */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/4 h-52 w-52 rounded-full bg-white/10 blur-2xl" />

      <div className="relative z-10 flex flex-col gap-4">
        {/* ----- Cartel + título ----- */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif text-2xl font-bold leading-snug drop-shadow-sm sm:text-3xl">
            {titulo}
          </h3>
          {promo.badge.trim() && (
            <span
              className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-extrabold uppercase tracking-wide shadow-sm"
              style={{ color: paleta.acento }}
            >
              ★ {promo.badge.trim()}
            </span>
          )}
        </div>

        {/* ----- Productos + precio / acciones ----- */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          {/* Imágenes */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* Principal */}
            <div
              className={`relative grid aspect-square place-items-center overflow-hidden rounded-2xl bg-white shadow-lg ${
                regalo ? "w-24 sm:w-32" : "w-32 sm:w-40"
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

          {/* Precio + acciones */}
          <div className="flex flex-col gap-3 sm:ml-auto sm:items-end">
            {promo.mostrarPrecio && product && product.precioVenta > 0 && (
              <p className="flex items-baseline gap-2">
                {enOferta && (
                  <span className="text-base text-white/60 line-through">
                    {formatARS(product.precioVenta)}
                  </span>
                )}
                <span className="text-3xl font-extrabold drop-shadow-sm sm:text-4xl">
                  {formatARS(
                    enOferta ? product.precioOferta! : product.precioVenta
                  )}
                </span>
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onAdd}
                disabled={!onAdd}
                className="rounded-xl bg-white px-6 py-2.5 text-sm font-bold shadow-md transition hover:scale-[1.03] disabled:cursor-default disabled:hover:scale-100"
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

        {/* ----- Descripción a todo el ancho (completa) ----- */}
        {promo.texto.trim() && (
          <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
            <p className="text-sm leading-relaxed text-white sm:text-base">
              {promo.texto.trim()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
