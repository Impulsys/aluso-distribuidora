import Image from "next/image";
import Link from "next/link";
import WhatsAppIcon from "@/components/WhatsAppIcon";

const WA_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";
const EMAIL = process.env.NEXT_PUBLIC_BUSINESS_EMAIL || "";
const PHONE = process.env.NEXT_PUBLIC_BUSINESS_PHONE || "";
const ADDRESS = process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || "";

const MAPA_SRC = `https://www.google.com/maps?q=${encodeURIComponent(
  ADDRESS
)}&z=16&output=embed`;
const MAPA_LINK = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  ADDRESS
)}`;

export default function LandingPage() {
  return (
    // 4rem = alto del header. Con esto la página entra JUSTO en la pantalla.
    <div
      // bg-left en celular: la foto es panorámica y con bg-center el recorte
      // dejaba el paquete de Doncella JUSTO detrás del texto, ilegible. Sobre
      // el borde izquierdo la imagen es lisa. En desktop entra entera y va centrada.
      // El diseño original era alto FIJO + overflow-hidden ("una sola pantalla").
      // Eso funcionaba mientras el pie estaba vacío; al cargar la dirección real
      // aparece el mapa, el pie crece y el overflow-hidden lo RECORTABA — se
      // perdían dirección, WhatsApp y mail, que es justo lo que hay que mostrar.
      // Ahora es min-height: el hero sigue ocupando la pantalla entera, pero si
      // el contenido no entra se scrollea en vez de cortarse.
      className="flex min-h-[calc(100dvh-4rem)] flex-col bg-cover bg-left md:bg-center bg-no-repeat relative"
      style={{
        backgroundImage: 'url(/bg-warehouse.png)',
      }}
    >
      {/* Overlay para legibilidad. El degradé horizontal servía en desktop
          (texto a la izquierda); en celular el texto ocupa todo el ancho, así
          que ahí se usa un velo claro parejo que sostiene el texto azul. */}
      {/* OJO: `bg-white/70` es background-COLOR y el degradé es background-IMAGE,
          así que NO se pisan entre sí. Sin `md:bg-transparent` el velo blanco
          seguía aplicándose en desktop y lavaba la foto. */}
      <div className="absolute inset-0 bg-white/70 md:bg-transparent md:bg-gradient-to-r md:from-black/40 md:via-black/20 md:to-transparent pointer-events-none"></div>

      {/* Contenido relativo al overlay */}
      <div className="relative z-10 flex flex-1 flex-col">
      {/* ============ PRESENTACIÓN ============ */}
      <section className="flex flex-1 items-center">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-8 px-5 py-6 sm:px-6 md:grid-cols-2 md:gap-12 md:py-8">
          {/* Texto a la izquierda */}
          <div>
            {/* Logo ALUSO. El scale(2.05) se ajustó a ojo en desktop, pero con
                origen a la izquierda hacía que en un celular de 320px el logo
                midiera el doble del ancho de pantalla y se cortara ("A... Dis").
                Ahora el zoom aplica solo de md para arriba. */}
            <div className="mt-3 w-full max-w-2xl">
              <div
                className="origin-left md:[transform:translate(27px,0px)_scale(2.05)]"
              >
                <Image
                  src="/logo-aluso.png"
                  alt="ALUSO DISTRIBUIDORA"
                  width={900}
                  height={300}
                  priority
                  className="w-full h-auto object-contain"
                />
              </div>
            </div>

            <p className="mt-4 max-w-xl text-sm leading-relaxed text-blue-600 font-semibold sm:text-base md:text-lg">
              Distribuimos las marcas <strong className="font-semibold text-rose-400">Doncella</strong> y{" "}
              {/* Verde de la marca Nonisec (caja Protección Adulta), el que pidió
                  el cliente. Inclina al verde (G>B), no es el turquesa puro que
                  había antes. Contraste sobre el fondo claro: 4,8:1, pasa AA. */}
              <strong className="font-semibold text-[#146B60]">Nonisec</strong> en
              farmacias, geriátricos, comercios y autoservicios de Argentina.
              Cuidado adulto, incontinencia, higiene femenina y
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

        </div>
      </section>

      {/* ============ PIE — contacto + mapa, en la misma pantalla ============ */}
      <footer className="border-t border-brand-border bg-landing-navy text-white">
        <div className="mx-auto grid max-w-6xl gap-4 px-5 py-5 sm:px-6 sm:py-6 md:grid-cols-[1fr_340px] md:items-center md:gap-6">
          <div>
            <p className="font-serif text-base font-medium sm:text-lg">
              ALUSO DISTRIBUIDORA
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
              {/* Mismo criterio que Footer.tsx: si todavía no hay datos, se dice
                  que están pendientes en vez de dejar el bloque vacío. */}
              {!ADDRESS && !WA_NUMBER && !EMAIL && (
                <li className="text-xs italic text-white/45">
                  Datos de contacto pendientes de configuración
                </li>
              )}
            </ul>
          </div>

          {/* Mapa a la derecha. Solo si hay dirección cargada: sin ella el
              embed queda en `maps?q=` vacío y muestra un mapa roto. */}
          {ADDRESS && (
            <div className="overflow-hidden rounded-xl ring-1 ring-white/15">
              <iframe
                src={MAPA_SRC}
                title="Ubicación de ALUSO DISTRIBUIDORA"
                className="h-[130px] w-full border-0 sm:h-[150px]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          )}
        </div>
      </footer>
      </div>
    </div>
  );
}

