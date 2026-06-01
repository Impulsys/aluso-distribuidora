"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWARegister() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  // Service worker: SOLO en producción. En desarrollo lo desregistramos y
  // limpiamos la caché, porque si no sirve versiones viejas de los archivos
  // (era la causa de ver pantallas "viejas" pese a recargar).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((e) => console.warn("SW register fail:", e));
    } else {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      if ("caches" in window) {
        caches
          .keys()
          .then((keys) => keys.forEach((k) => caches.delete(k)))
          .catch(() => {});
      }
    }
  }, []);

  // Capturar el evento "instalable"
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onBefore = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    // Cargar si el usuario ya descartó el banner antes
    try {
      if (localStorage.getItem("pwa_dismiss") === "1") setDismissed(true);
    } catch {}
    window.addEventListener("beforeinstallprompt", onBefore);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBefore);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || dismissed || !installEvent) return null;

  const install = async () => {
    try {
      await installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      if (outcome === "dismissed") {
        setDismissed(true);
        try {
          localStorage.setItem("pwa_dismiss", "1");
        } catch {}
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setInstallEvent(null);
    }
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem("pwa_dismiss", "1");
    } catch {}
  };

  return (
    <div className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-sm rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-black/10 sm:left-auto sm:right-4">
      <div className="flex items-start gap-3">
        <img
          src="/icons/icon-96.png"
          alt=""
          aria-hidden
          className="h-12 w-12 flex-none rounded-xl"
        />
        <div className="flex-1">
          <p className="font-semibold text-brand-dark">
            Instalar Los Amigos NOA
          </p>
          <p className="mt-0.5 text-xs text-brand-dark/65">
            Agregá la app al inicio de tu celular. Carga rápido y funciona
            aunque tengas mala señal.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={install}
              className="flex-1 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              Instalar
            </button>
            <button
              onClick={dismiss}
              className="rounded-full border border-brand-border bg-surface px-4 py-1.5 text-sm font-medium text-brand-dark/70 hover:bg-primary-light"
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
