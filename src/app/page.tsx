"use client";

import React from "react";
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
  // Herramienta de posicionamiento del logo (arrastrar + escalar)
  const [logoX, setLogoX] = React.useState(0);
  const [logoY, setLogoY] = React.useState(0);
  const [logoScale, setLogoScale] = React.useState(1);
  const [dragging, setDragging] = React.useState(false);
  const [start, setStart] = React.useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setStart({ x: e.clientX, y: e.clientY });
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      setLogoX((prev) => prev + (e.clientX - start.x));
      setLogoY((prev) => prev + (e.clientY - start.y));
      setStart({ x: e.clientX, y: e.clientY });
    };
    const handleMouseUp = () => setDragging(false);
    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragging, start]);

  return (
    // 4rem = alto del header. Con esto la página entra JUSTO en la pantalla.
    <div
      className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: 'url(/bg-warehouse.png)',
      }}
    >
      {/* Overlay sutil para legibilidad de texto */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/20 to-transparent pointer-events-none"></div>

      {/* Contenido relativo al overlay */}
      <div className="relative z-10 flex flex-1 flex-col">
      {/* ============ PRESENTACIÓN ============ */}
      <section className="flex flex-1 items-center">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-8 px-5 py-6 sm:px-6 md:grid-cols-2 md:gap-12 md:py-8">
          {/* Texto a la izquierda */}
          <div>
            <div className="mt-3 w-full max-w-2xl">
              <div
                className="cursor-grab active:cursor-grabbing"
                style={{
                  transform: `translate(${logoX}px, ${logoY}px) scale(${logoScale})`,
                  transformOrigin: "left center",
                  userSelect: "none",
                }}
                onMouseDown={handleMouseDown}
              >
                <Image
                  src="/logo-aluso.png"
                  alt="ALUSO DISTRIBUIDORA"
                  width={900}
                  height={300}
                  priority
                  draggable={false}
                  className="w-full h-auto object-contain pointer-events-none"
                />
              </div>
            </div>

            {/* Panel de control del logo */}
            <div className="fixed bottom-4 right-4 z-50 bg-black/85 text-white p-3 rounded-lg text-xs font-mono shadow-xl">
              <div>Logo X: <strong>{logoX}px</strong></div>
              <div>Logo Y: <strong>{logoY}px</strong></div>
              <div>Tamaño: <strong>{logoScale.toFixed(2)}x</strong></div>
              <div className="mt-2 flex items-center gap-2">
                <span>-</span>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.05"
                  value={logoScale}
                  onChange={(e) => setLogoScale(parseFloat(e.target.value))}
                  className="w-28"
                />
                <span>+</span>
              </div>
              <button
                onClick={() => {
                  const vals = `X:${logoX} Y:${logoY} Scale:${logoScale.toFixed(2)}`;
                  navigator.clipboard.writeText(vals);
                  alert("Copiado → " + vals);
                }}
                className="mt-2 bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded w-full"
              >
                Copiar valores
              </button>
            </div>

            <p className="mt-4 max-w-xl text-sm leading-relaxed text-blue-600 font-semibold sm:text-base md:text-lg">
              Distribuimos las marcas <strong className="font-semibold text-rose-400">Doncella</strong> y{" "}
              <strong className="font-semibold text-teal-400">Nonisec</strong> en
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
            </ul>
          </div>

          {/* Mapa a la derecha */}
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
        </div>
      </footer>
      </div>
    </div>
  );
}

