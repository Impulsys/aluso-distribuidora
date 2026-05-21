import { Suspense } from "react";
import Image from "next/image";
import ProductCatalog from "@/components/ProductCatalog";
import FeaturedBanner from "@/components/FeaturedBanner";
import MarqueeProducts from "@/components/MarqueeProducts";

const StatPill = ({
  icon,
  label,
  iconBg,
}: {
  icon: string;
  label: string;
  iconBg: string;
}) => (
  <div className="group inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/10 py-1.5 pl-1.5 pr-4 text-sm font-medium text-white shadow-sm backdrop-blur-md transition hover:border-white/30 hover:bg-white/15">
    <span
      className={`grid h-7 w-7 place-items-center rounded-full text-base shadow-inner ${iconBg}`}
    >
      {icon}
    </span>
    {label}
  </div>
);

export default function CatalogoPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* === HERO con productos pasando como FONDO === */}
      <section
        className="relative mb-8 min-h-[300px] overflow-hidden rounded-2xl text-white"
        style={{
          background:
            "linear-gradient(135deg, #1ca5c8 0%, #0a8db5 45%, #006081 100%)",
        }}
      >
        {/* Capa 1: carrusel de productos como fondo */}
        <div className="absolute inset-0 z-0">
          <MarqueeProducts variant="background" />
        </div>

        {/* Capa 2: overlay degradado para legibilidad del texto */}
        <div
          className="absolute inset-0 z-10"
          style={{
            background:
              "linear-gradient(to right, rgba(10,141,181,0.95) 0%, rgba(10,141,181,0.75) 35%, rgba(10,141,181,0.1) 75%, transparent 100%)",
          }}
        />
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/15 to-transparent" />

        {/* Capa 3: contenido */}
        <div className="relative z-20 grid gap-6 px-6 py-10 sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="max-w-xl">
            <h1 className="text-2xl font-bold sm:text-3xl">
              Distribuidora mayorista — Doncella & Nonisec
            </h1>
            <p className="mt-2 text-secondary">
              Línea femenina, bebé y de incontinencia adulta. Productos
              Lenterdit al mejor precio mayorista del NOA. Armá tu pedido y
              enviálo por WhatsApp en segundos.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <StatPill icon="📦" label="80+ productos" iconBg="bg-emerald-500/90" />
              <StatPill icon="🚚" label="Entrega en NOA" iconBg="bg-amber-500/90" />
              <StatPill icon="💬" label="Pedido por WhatsApp" iconBg="bg-[#25D366]/90" />
            </div>
          </div>
          <div className="hidden gap-3 self-start rounded-xl bg-white/95 p-3 shadow-lg sm:flex">
            <div className="grid place-items-center">
              <Image
                src="/brand/doncella.png"
                alt="Doncella"
                width={120}
                height={60}
                className="h-10 w-auto object-contain"
              />
            </div>
            <div className="grid place-items-center border-l border-brand-border pl-3">
              <Image
                src="/brand/nonisec.png"
                alt="Nonisec"
                width={120}
                height={60}
                className="h-10 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      <FeaturedBanner />

      <Suspense
        fallback={
          <p className="py-12 text-center text-brand-dark/60">Cargando catálogo…</p>
        }
      >
        <ProductCatalog />
      </Suspense>
    </div>
  );
}
