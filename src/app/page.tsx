import Image from "next/image";
import Link from "next/link";
import WhatsAppIcon from "@/components/WhatsAppIcon";

/*
 * Pantalla de inicio: UNA sola pantalla, sin scroll.
 * Pedido del cliente (14/07/2026): nombre, las dos marcas, una descripción corta
 * y una imagen. Abajo, en el pie de ESA MISMA pantalla, dirección + WhatsApp +
 * mapa. Nada más: sin botones de catálogo, sin secciones para deslizar.
 * Fondo BLANCO plano — el violeta con degradé se fue.
 */

const WA_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";
const EMAIL = process.env.NEXT_PUBLIC_BUSINESS_EMAIL || "";
const PHONE = process.env.NEXT_PUBLIC_BUSINESS_PHONE || "";
const ADDRESS = process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || "";

// Mapa embebido de Google (no necesita API key).
const MAPA_SRC = `https://www.google.com/maps?q=${encodeURIComponent(
  ADDRESS
)}&z=16&output=embed`;
const MAPA_LINK = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  ADDRESS
)}`;

export default function LandingPage() {
  return (
    // 4rem = alto del header. Con esto la página entra JUSTO en la pantalla.
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col overflow-x-hidden bg-white">
      {/* ============ PRESENTACIÓN ============ */}
      <section className="flex flex-1 items-center">
        {/* En el celular va todo apilado (texto arriba, packs abajo). */}
        <div className="mx-auto grid w-full max-w-7xl items-center gap-6 px-5 py-6 sm:px-6 md:grid-cols-[1fr_1.25fr] md:gap-8 md:py-8">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary sm:text-[11px] sm:tracking-[0.22em]">
              Distribuidora mayorista · Noroeste argentino
            </p>

            <h1 className="mt-3 font-serif text-4xl font-light leading-[1.05] text-brand-dark sm:text-5xl md:mt-4 lg:text-6xl">
              Distribuidora
              <br />
              Los Amigos
            </h1>

            <p className="mt-4 flex items-center gap-3 text-base font-medium text-brand-dark/80 sm:mt-5 sm:text-lg">
              Doncella
              <span className="h-1 w-1 rounded-full bg-brand-dark/25" />
              Nonisec
            </p>

            <p className="mt-4 max-w-xl text-sm leading-relaxed text-brand-dark/70 sm:mt-6 sm:text-[15px] md:text-base">
              Distribuimos las marcas <strong className="font-semibold text-brand-dark">Doncella</strong> y{" "}
              <strong className="font-semibold text-brand-dark">Nonisec</strong> en
              farmacias, geriátricos, comercios y autoservicios del Noroeste
              argentino. Cuidado adulto, incontinencia, higiene femenina y
              algodón, con stock permanente y logística propia. Atención directa
              con el fabricante y precios mayoristas para tu negocio.
            </p>

            <Link
              href="/catalogo"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-rose-500 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-rose-500/30 transition hover:-translate-y-0.5 hover:bg-rose-600 hover:shadow-xl hover:shadow-rose-500/40 sm:mt-7 sm:px-8 sm:py-3.5"
            >
              Ver el catálogo
              <span aria-hidden>→</span>
            </Link>
          </div>

          {/*
            Las dos presentaciones de Doncella (rosa y verde), centradas en el
            campo blanco. Se superponen un poco para ganar tamaño: los JPG son
            cuadrados y traen aire propio alrededor del pack.
          */}
          <div className="mx-auto flex w-full max-w-[560px] items-center justify-center md:max-w-none">
            <div className="relative aspect-square w-[50%] shrink-0">
              <Image
                src="/productos/7790940216212.jpg"
                alt="Doncella Normal dúo pack — tela suave con alas, sin perfume"
                fill
                priority
                sizes="(max-width: 768px) 50vw, 400px"
                className="object-contain"
              />
            </div>
            <div className="relative -ml-[6%] aspect-square w-[50%] shrink-0">
              <Image
                src="/productos/7790940216229.jpg"
                alt="Doncella Normal dúo pack — tela suave con alas, con perfume"
                fill
                priority
                sizes="(max-width: 768px) 50vw, 400px"
                className="object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============ PIE — contacto + mapa, en la misma pantalla ============ */}
      <footer className="border-t border-brand-border bg-landing-navy text-white">
        <div className="mx-auto grid max-w-6xl gap-4 px-5 py-5 sm:px-6 sm:py-6 md:grid-cols-[1fr_340px] md:items-center md:gap-6">
          <div>
            <p className="font-serif text-base font-medium sm:text-lg">
              Distribuidora Los Amigos
            </p>

            <ul className="mt-3 space-y-2 text-[13px] text-white/85 sm:text-sm">
              {ADDRESS && (
                <li>
                  <a
                    href={MAPA_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-start gap-2 hover:text-secondary"
                  >
                    <span aria-hidden>📍</span> {ADDRESS}
                  </a>
                </li>
              )}
              {WA_NUMBER && (
                <li>
                  <a
                    href={`https://wa.me/${WA_NUMBER}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 hover:text-secondary"
                  >
                    <WhatsAppIcon className="h-4 w-4" />
                    {PHONE || "WhatsApp"}
                  </a>
                </li>
              )}
              {EMAIL && (
                <li>
                  <a
                    href={`mailto:${EMAIL}`}
                    className="inline-flex items-center gap-2 hover:text-secondary"
                  >
                    <span aria-hidden>📧</span> {EMAIL}
                  </a>
                </li>
              )}
            </ul>
          </div>

          {/* Mapa a la derecha */}
          <div className="overflow-hidden rounded-xl ring-1 ring-white/15">
            <iframe
              src={MAPA_SRC}
              title="Ubicación de Distribuidora Los Amigos"
              className="h-[130px] w-full border-0 sm:h-[150px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </div>
      </footer>
    </div>
  );
}
