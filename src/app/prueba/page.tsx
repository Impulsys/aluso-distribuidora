"use client";

import { useAuth } from "@/context/AuthContext";
import { ROLE_LABELS } from "@/lib/types";
import { PRODUCTOS_SEED } from "@/data/productos";
import { waLink, waNumber } from "@/lib/whatsapp";

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`grid h-5 w-5 place-items-center rounded-full text-xs font-bold text-white ${
          ok ? "bg-primary" : "bg-accent"
        }`}
      >
        {ok ? "✓" : "✗"}
      </span>
      <span className="text-sm">{label}</span>
    </li>
  );
}

export default function PruebaPage() {
  const { user, loading, signInGoogle, signOut } = useAuth();

  const env = {
    apiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    projectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    senderId: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    whatsapp: !!waNumber(),
  };

  const msgPrueba =
    "Hola Distribuidora Los Amigos NOA 👋 Esto es un mensaje de PRUEBA desde la plataforma.";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-primary">
        Página de prueba — Estado del sistema
      </h1>
      <p className="mt-1 text-sm text-brand-dark/60">
        Distribuidora Los Amigos NOA · Fase 1 · Hecho por Impulsys
      </p>

      <section className="mt-6 rounded-xl border border-brand-border bg-surface p-5">
        <h2 className="mb-3 font-bold text-brand-dark">
          1 · Conexión Firebase / config
        </h2>
        <ul className="space-y-2">
          <Check ok={env.projectId} label="Project ID configurado" />
          <Check
            ok={env.apiKey}
            label="API Key web (pendiente: copiar de la consola)"
          />
          <Check ok={env.appId} label="App ID web (pendiente)" />
          <Check ok={env.senderId} label="Messaging Sender ID (pendiente)" />
          <Check
            ok={env.whatsapp}
            label={`WhatsApp central: ${waNumber() || "no configurado"}`}
          />
        </ul>
      </section>

      <section className="mt-4 rounded-xl border border-brand-border bg-surface p-5">
        <h2 className="mb-3 font-bold text-brand-dark">
          2 · Login con Google + rol
        </h2>
        {loading ? (
          <p className="text-sm text-brand-dark/60">Cargando…</p>
        ) : user ? (
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="font-medium">{user.displayName}</p>
              <p className="text-sm text-brand-dark/60">{user.email}</p>
              <p className="mt-1 inline-block rounded bg-primary-light px-2 py-0.5 text-sm font-semibold text-primary">
                Rol: {ROLE_LABELS[user.role]}
              </p>
            </div>
            <button
              onClick={() => signOut()}
              className="rounded bg-accent px-4 py-2 font-medium text-white"
            >
              Salir
            </button>
          </div>
        ) : (
          <div>
            <button
              onClick={() => signInGoogle()}
              className="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark"
            >
              Ingresar con Google
            </button>
            <p className="mt-2 text-xs text-brand-dark/50">
              Requiere las claves web de Firebase cargadas. Sin ellas, el botón
              dará error de configuración (esperado hasta completar el punto 1).
            </p>
          </div>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-brand-border bg-surface p-5">
        <h2 className="mb-3 font-bold text-brand-dark">3 · Test de WhatsApp</h2>
        <a
          href={waLink(msgPrueba)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded bg-[#25D366] px-4 py-2 font-medium text-white"
        >
          Enviar mensaje de prueba por WhatsApp
        </a>
        <p className="mt-2 text-xs text-brand-dark/50">
          Abre WhatsApp al número {waNumber()} con un mensaje precargado.
        </p>
      </section>

      <section className="mt-4 rounded-xl border border-brand-border bg-surface p-5">
        <h2 className="mb-2 font-bold text-brand-dark">4 · Catálogo semilla</h2>
        <p className="text-sm">
          {PRODUCTOS_SEED.length} productos de pañalería cargados ·{" "}
          <a href="/" className="font-medium text-primary underline">
            ver catálogo
          </a>
        </p>
      </section>
    </div>
  );
}
