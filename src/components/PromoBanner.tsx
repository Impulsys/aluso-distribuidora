"use client";

import Image from "next/image";
import { getPaleta, COLOR_TEXTO_DEFAULT } from "@/lib/promos";
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
    | "colorTexto"
    | "mostrarPrecio"
    | "cantidadLleva"
    | "cantidadRegalo"
    | "textoRegalo"
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
 * Cuadrante de promoción: fondo de color sólido, productos directos (sin
 * tarjeta blanca), principal y regalo mitad y mitad. Se usa en la grilla del
 * catálogo (2×2) y en la vista previa del editor.
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
  const color = promo.colorTexto || COLOR_TEXTO_DEFAULT;
  const titulo = (promo.titulo?.trim() || product?.nombre) ?? "Producto";
  const enOferta =
    !!product &&
    (product.precioOferta ?? 0) > 0 &&
    (product.precioOferta ?? 0) < product.precioVenta;
  const cantLleva =
    promo.cantidadLleva && promo.cantidadLleva > 0 ? promo.cantidadLleva : 0;
  const cantRegalo =
    promo.cantidadRegalo && promo.cantidadRegalo > 0 ? promo.cantidadRegalo : 1;
  const etiquetaRegalo = (promo.textoRegalo?.trim() || "GRATIS").toUpperCase();

  return (
    <div
      className="relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl p-4 shadow-md sm:p-5"
      style={{ background: paleta.bg, color }}
    >
      {/* Cartel */}
      {promo.badge.trim() && (
        <span
          className="mx-auto rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-white shadow-sm"
          style={{ background: paleta.acento }}
        >
          ★ {promo.badge.trim()}
        </span>
      )}

      {/* Productos: principal | regalo (mitad y mitad) */}
      <div
        className={`grid flex-1 items-center gap-1 ${
          regalo ? "grid-cols-[1fr_auto_1fr]" : "grid-cols-1"
        }`}
      >
        {/* Principal */}
        <div className="relative flex h-56 items-center justify-center sm:h-80">
          {product ? (
            <Image
              src={product.imagen}
              alt={titulo}
              width={500}
              height={500}
              className="h-full w-auto max-w-full object-contain"
              style={{ mixBlendMode: "multiply" }}
            />
          ) : (
            <span className="text-xs opacity-50">Sin producto</span>
          )}
          {cantLleva > 0 && (
            <span
              className="absolute left-0 top-0 rounded-full px-2 py-0.5 text-xs font-extrabold text-white shadow"
              style={{ background: paleta.acento }}
            >
              ×{cantLleva}
            </span>
          )}
        </div>

        {/* Regalo (opcional) */}
        {regalo && (
          <>
            <span
              className="text-2xl font-black opacity-70 sm:text-3xl"
              style={{ color: paleta.acento }}
            >
              +
            </span>
            <div className="relative flex h-48 items-center justify-center sm:h-64">
              <Image
                src={regalo.imagen}
                alt={regalo.nombre}
                width={420}
                height={420}
                className="h-full w-auto max-w-full object-contain"
                style={{ mixBlendMode: "multiply" }}
              />
              <span className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white shadow">
                🎁 {etiquetaRegalo}
              </span>
              <span className="absolute bottom-0 right-0 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[11px] font-extrabold text-white shadow ring-1 ring-white/70">
                ×{cantRegalo}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Título + descripción */}
      <div className="text-center">
        <h3 className="line-clamp-2 font-serif text-base font-bold leading-snug sm:text-xl">
          {titulo}
        </h3>
        {promo.texto.trim() && (
          <p className="mt-0.5 line-clamp-2 text-xs opacity-80 sm:text-sm">
            {promo.texto.trim()}
          </p>
        )}
      </div>

      {/* Precio */}
      {promo.mostrarPrecio && product && product.precioVenta > 0 && (
        <p className="flex items-baseline justify-center gap-2">
          {enOferta && (
            <span className="text-sm opacity-50 line-through">
              {formatARS(product.precioVenta)}
            </span>
          )}
          <span className="text-2xl font-extrabold sm:text-3xl">
            {formatARS(enOferta ? product.precioOferta! : product.precioVenta)}
          </span>
        </p>
      )}

      {/* Acciones */}
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={onAdd}
          disabled={!onAdd}
          className="rounded-xl px-6 py-2 text-sm font-bold text-white shadow-md transition hover:scale-[1.03] disabled:cursor-default disabled:hover:scale-100"
          style={{ background: paleta.acento }}
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
            className="grid h-10 w-10 place-items-center rounded-xl bg-[#25D366] text-white shadow-md transition hover:scale-[1.03]"
          >
            <WhatsAppIcon className="h-5 w-5" />
          </a>
        ) : (
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#25D366] text-white shadow-md">
            <WhatsAppIcon className="h-5 w-5" />
          </span>
        )}
      </div>
    </div>
  );
}
