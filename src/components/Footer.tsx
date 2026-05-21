import Link from "next/link";
import Image from "next/image";

const WA_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";
const EMAIL = process.env.NEXT_PUBLIC_BUSINESS_EMAIL || "";
const PHONE_DISPLAY = process.env.NEXT_PUBLIC_BUSINESS_PHONE || "";
const ADDRESS = process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || "";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-brand-border bg-landing-navy text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        {/* Marca */}
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary font-bold text-primary">
              LA
            </span>
            <div className="leading-tight">
              <p className="font-serif text-lg font-medium">
                Distribuidora Los Amigos
              </p>
              <p className="text-xs text-white/60">NOA · Argentina</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-white/70">
            Distribución mayorista de productos Lenterdit (Doncella & Nonisec)
            para farmacias, geriátricos y comercios del Noroeste argentino.
          </p>
        </div>

        {/* Contacto */}
        <div>
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-white/55">
            Contacto
          </h3>
          <ul className="space-y-2 text-sm text-white/85">
            {WA_NUMBER && (
              <li>
                <a
                  href={`https://wa.me/${WA_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-secondary"
                >
                  💬 WhatsApp
                </a>
              </li>
            )}
            {PHONE_DISPLAY && (
              <li>
                <a
                  href={`tel:${PHONE_DISPLAY.replace(/\s+/g, "")}`}
                  className="inline-flex items-center gap-2 hover:text-secondary"
                >
                  📞 {PHONE_DISPLAY}
                </a>
              </li>
            )}
            {EMAIL && (
              <li>
                <a
                  href={`mailto:${EMAIL}`}
                  className="inline-flex items-center gap-2 hover:text-secondary"
                >
                  📧 {EMAIL}
                </a>
              </li>
            )}
            {ADDRESS && (
              <li className="inline-flex items-start gap-2 text-white/75">
                📍 {ADDRESS}
              </li>
            )}
            {!PHONE_DISPLAY && !EMAIL && !ADDRESS && (
              <li className="text-xs italic text-white/45">
                Datos de contacto pendientes de configuración
              </li>
            )}
          </ul>
        </div>

        {/* Marcas */}
        <div>
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-white/55">
            Nuestras marcas
          </h3>
          <div className="space-y-2">
            <Link
              href="/catalogo?marca=doncella"
              className="block rounded-lg bg-white/95 px-3 py-2 transition hover:bg-secondary"
            >
              <Image
                src="/brand/doncella.png"
                alt="Doncella"
                width={120}
                height={32}
                className="h-7 w-auto object-contain"
              />
            </Link>
            <Link
              href="/catalogo?marca=nonisec"
              className="block rounded-lg bg-white/95 px-3 py-2 transition hover:bg-secondary"
            >
              <Image
                src="/brand/nonisec.png"
                alt="Nonisec"
                width={120}
                height={32}
                className="h-7 w-auto object-contain"
              />
            </Link>
          </div>
          <div className="mt-3 flex gap-2 text-xs text-white/65">
            <a
              href="https://instagram.com/nonisec"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-secondary"
            >
              📷 @nonisec
            </a>
            <span>·</span>
            <a
              href="https://instagram.com/doncellafem"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-secondary"
            >
              @doncellafem
            </a>
          </div>
        </div>

        {/* Legales + navegación */}
        <div>
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-white/55">
            La plataforma
          </h3>
          <ul className="space-y-2 text-sm text-white/85">
            <li>
              <Link href="/catalogo" className="hover:text-secondary">
                Catálogo mayorista
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-secondary">
                Ingreso del equipo
              </Link>
            </li>
            <li>
              <Link href="/terminos" className="hover:text-secondary">
                Términos y condiciones
              </Link>
            </li>
            <li>
              <Link href="/privacidad" className="hover:text-secondary">
                Política de privacidad
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Línea inferior */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-white/55 sm:flex-row">
          <p>© {year} Distribuidora Los Amigos NOA</p>
          <p>
            Hecho por <span className="font-medium text-white/85">Impulsys</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
