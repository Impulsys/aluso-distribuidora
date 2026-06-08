import { Suspense, type ReactNode } from "react";
import Image from "next/image";
import ProductCatalog from "@/components/ProductCatalog";
import PromoCarousel from "@/components/PromoCarousel";
import MarqueeProducts from "@/components/MarqueeProducts";
import WhatsAppIcon from "@/components/WhatsAppIcon";

const StatPill = ({
  icon,
  label,
  iconBg,
}: {
  icon: ReactNode;
  label: string;
  iconBg: string;
}) => (
  <div className="group inline-flex items-center gap-2.5 rounded-full border border-brand-border bg-white py-1.5 pl-1.5 pr-4 text-sm font-medium text-brand-dark shadow-sm transition hover:border-primary/40 hover:bg-primary-light/30">
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
      <section className="relative mb-8 min-h-[300px] overflow-hidden rounded-2xl border border-brand-border bg-white text-brand-dark">
        {/* Capa 1: carrusel de productos como fondo */}
        <div className="absolute inset-0 z-0">
          <MarqueeProducts variant="background" />
        </div>

        {/* Capa 2: overlay BLANCO para legibilidad del texto (deja ver el carrusel a la derecha) */}
        <div
          className="absolute inset-0 z-10"
          style={{
            background:
              "linear-gradient(to right, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.9) 38%, rgba(255,255,255,0.25) 75%, rgba(255,255,255,0) 100%)",
          }}
        />

        {/* Capa 3: contenido */}
        <div className="relative z-20 grid gap-6 px-6 py-10 sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="max-w-xl">
            <h1 className="text-2xl font-bold sm:text-3xl">
              Distribuidora mayorista — Doncella & Nonisec
            </h1>
            <p className="mt-2 text-brand-dark/70">
              Línea femenina, bebé y de incontinencia adulta. Productos
              Lenterdit al mejor precio mayorista del NOA. Armá tu pedido y
              enviálo por WhatsApp en segundos.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <StatPill icon="📦" label="80+ productos" iconBg="bg-emerald-500/90" />
              <StatPill icon="🚚" label="Entrega en NOA" iconBg="bg-amber-500/90" />
              <StatPill
                icon={<WhatsAppIcon className="h-4 w-4 text-white" />}
                label="Pedido por WhatsApp"
                iconBg="bg-[#25D366]/90"
              />
            </div>
          </div>
          <div className="hidden gap-3 self-start rounded-xl border border-brand-border bg-white p-3 shadow-md sm:flex">
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

      <PromoCarousel />

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
