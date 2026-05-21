"use client";

import Image from "next/image";
import Link from "next/link";
import { PRODUCTOS_SEED } from "@/data/productos";
import { MARCAS } from "@/lib/types";

// IDs curados para el carrusel — mix Doncella + Nonisec, fotos reales locales.
const FEATURED_IDS = [
  "7790940216205", // Doncella toalla pocket tanga
  "7790940410245", // Nonisec adulto ultra grande
  "7790940233240", // Doncella protector diario
  "7790940888327", // Nonisec juvenil ultra
  "7790940216212", // Doncella toalla
  "7790940518026", // Doncella Fem
  "7790940410504", // Nonisec adulto extra
  "7790940003034", // Doncella algodón
  "7790940110008", // Nonisec recto
  "7790940216151", // Doncella toalla
  "7790940233264", // Doncella protector c/perfume
  "7790940411266", // Nonisec ropa interior
  "7790940410252", // Nonisec adulto ultra XG
  "7790940518033", // Doncella Fem medium
];

const MARCA_CHIP: Record<string, string> = {
  doncella: "bg-rose-600",
  nonisec: "bg-sky-700",
  lenterdit: "bg-emerald-700",
};

export default function MarqueeProducts({
  variant = "strip",
}: {
  variant?: "strip" | "background";
}) {
  const productos = FEATURED_IDS.map((id) =>
    PRODUCTOS_SEED.find((p) => p.id === id)
  ).filter((p): p is NonNullable<typeof p> => Boolean(p));

  // Duplicado x2 para loop sin cortes
  const loop = [...productos, ...productos];

  if (variant === "background") {
    return (
      <div className="relative h-full w-full overflow-hidden">
        <div className="animate-marquee flex h-full w-max items-center">
          {loop.map((p, i) => (
            <div
              key={`${p.id}-${i}`}
              className="relative h-full aspect-square flex-none"
            >
              <Image
                src={p.imagen}
                alt={p.nombre}
                fill
                sizes="320px"
                className="object-contain mix-blend-multiply"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // === STRIP (default) ===
  return (
    <div className="group relative overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-primary to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-primary to-transparent" />
      <div className="animate-marquee flex w-max gap-3 py-1">
        {loop.map((p, i) => (
          <Link
            key={`${p.id}-${i}`}
            href={`/catalogo?marca=${p.marca}`}
            className="group/card flex w-40 flex-none flex-col overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl"
            aria-label={p.nombre}
          >
            <div className="relative aspect-square bg-white">
              <Image
                src={p.imagen}
                alt={p.nombre}
                fill
                sizes="160px"
                className="object-contain p-2 transition-transform duration-500 group-hover/card:scale-110"
              />
              <span
                className={`absolute left-2 top-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow ${MARCA_CHIP[p.marca]}`}
              >
                {MARCAS[p.marca]}
              </span>
            </div>
            <div className="px-2 py-1.5">
              <p className="line-clamp-2 text-[11px] font-medium leading-tight text-brand-dark">
                {p.nombre}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
