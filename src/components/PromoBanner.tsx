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
      className="relative overflow-hidden rounded-3xl p-6 text-center text-white shadow-xl sm:p-8"
      style={{ background: paleta.bg }}
    >
      {/* Brillos decorativos */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/4 h-52 w-52 rounded-full bg-white/10 blur-2xl" />

      <div className="relative z-10 flex flex-col items-center gap-4">
        {/* ----- Cartel al medio ----- */}
        {promo.badge.trim() && (
          <span
            className="rounded-full bg-white px-4 py-1 text-sm font-extrabold uppercase tracking-wide shadow-md"
            style={{ color: paleta.acento }}
          >
            ★ {promo.badge.trim()}
          </span>
        )}

        {/* ----- Imágenes: principal (+ regalo) ----- */}
        <div className="flex items-center justify-center gap-3 sm:gap-4">
          {/* Principal */}
          <div
            className={`relative grid place-items-center overflow-hidden rounded-2xl bg-white p-1 shadow-lg ${
              regalo ? "h-28 w-28 sm:h-36 sm:w-36" : "h-32 w-32 sm:h-44 sm:w-44"
            }`}
          >
            {product ? (
              <Image
                src={product.imagen}
                alt={titulo}
                width={300}
                height={300}
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-xs text-slate-400">Sin producto</span>
            )}
            {cantLleva > 0 && (
              <span
                className="absolute left-1 top-1 rounded-full px-2 py-0.5 text-xs font-extrabold text-white shadow"
                style={{ background: paleta.acento }}
              >
                ×{cantLleva}
              </span>
            )}
          </div>

          {/* Regalo (opcional) */}
          {regalo && (
            <>
              <span className="text-3xl font-black text-white/90 drop-shadow">
                +
              </span>
              <div className="relative grid h-20 w-20 place-items-center overflow-hidden rounded-2xl bg-white p-1 shadow-lg sm:h-24 sm:w-24">
                <Image
                  src={regalo.imagen}
                  alt={regalo.nombre}
                  width={200}
                  height={200}
                  className="h-full w-full object-contain"
                />
                <span className="absolute left-0 right-0 top-0 bg-emerald-500 py-1 text-center text-[12px] font-extrabold uppercase tracking-wider text-white shadow-sm">
                  🎁 Gratis
                </span>
                <span className="absolute bottom-1 right-1 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[11px] font-extrabold text-white shadow ring-1 ring-white/70">
                  ×{cantRegalo}
                </span>
              </div>
            </>
          )}
        </div>

        {/* ----- Título (acotado, no domina la pieza) ----- */}
        <h3 className="line-clamp-2 max-w-2xl font-serif text-lg font-bold leading-snug drop-shadow-sm sm:text-2xl">
          {titulo}
        </h3>

        {/* ----- Descripción de la oferta ----- */}
        {promo.texto.trim() && (
          <p className="max-w-2xl text-sm leading-relaxed text-white/95 sm:text-base">
            {promo.texto.trim()}
          </p>
        )}

        {/* ----- Precio (con anclaje + ahorro) ----- */}
        {promo.mostrarPrecio && product && product.precioVenta > 0 && (
          <div className="flex flex-col items-center gap-1">
            <p className="flex items-baseline justify-center gap-2">
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
            {enOferta && (
              <span className="rounded-full bg-amber-300 px-3 py-0.5 text-xs font-extrabold uppercase tracking-wide text-amber-950 shadow-sm">
                Ahorrás {formatARS(product.precioVenta - product.precioOferta!)}
              </span>
            )}
          </div>
        )}

        {/* ----- Acciones ----- */}
        <div className="flex items-center justify-center gap-2">
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
  );
}
