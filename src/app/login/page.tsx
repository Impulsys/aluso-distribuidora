"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { usernameToEmail } from "@/lib/userAdmin";
import type { Role } from "@/lib/types";

/** A dónde va cada rol al entrar: el depo y el contador tienen su área propia. */
function homeParaRol(role?: Role): string {
  if (role === "deposito") return "/deposito";
  if (role === "contador") return "/contador";
  return "/";
}

// Acá había un "MODO DEMO": una lista de usuarios de prueba con sus contraseñas
// (superadmin@aluso.test / SuperAdmin123!, etc.) y un desplegable en el login
// que las autocompletaba de un click. Dos problemas:
//   1. Iba en el bundle del cliente, así que las contraseñas eran PÚBLICAS.
//   2. Le mostraba al cliente un acceso "Superadmin (Anabela)" en la pantalla
//      de ingreso, invitando a probarlo.
// Las cuentas nunca llegaron a existir en Auth (se verificó), así que no hubo
// puerta trasera abierta — pero si alguien las creaba, quedaba servida.
// Si hace falta un usuario de prueba, se crea desde el panel de usuarios.

export default function LoginPage() {
  const { signInEmail, signUpEmail, signInGoogle, resetPassword, user } =
    useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  // La app es estática: el HTML pinta al instante pero el JS que hace andar el
  // botón "despierta" (hidrata) una fracción después. Hasta que `hydrated` sea
  // true, el botón queda deshabilitado para que el PRIMER click nunca se pierda.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Ya logueado (o recién logueado): lo mandamos a SU área según el rol. Se hace
  // acá, en el origen, para no depender de rebotes en el header. El depósito y el
  // contador caen directo en su pantalla; el resto, a la portada.
  useEffect(() => {
    if (user) router.replace(homeParaRol(user.role));
  }, [user, router]);

  if (user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-lg">Entrando…</p>
      </div>
    );
  }

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResetMsg(null);
    setBusy(true);
    try {
      await signInEmail(usernameToEmail(email), password);
      // El redirect por rol lo hace el useEffect de arriba cuando `user` resuelve.
    } catch {
      setError("Usuario o contraseña incorrectos.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResetMsg(null);
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setBusy(true);
    try {
      await signUpEmail(nombre, email.trim(), password);
      // Redirect por rol vía el useEffect (un alta nueva es cliente → portada).
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth/email-already-in-use") {
        setError("Ya existe una cuenta con ese email. Probá ingresar.");
      } else if (code === "auth/invalid-email") {
        setError("El email no es válido.");
      } else {
        setError("No se pudo crear la cuenta. Revisá los datos e intentá de nuevo.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setError("");
    setResetMsg(null);
    if (!email.trim()) {
      setError("Ingresá tu usuario o email arriba primero y volvé a tocar el link.");
      return;
    }
    if (!email.includes("@")) {
      setError(
        "El reseteo por email es solo para cuentas con correo real. Si tu cuenta es de usuario, pedile al administrador que te cambie la contraseña."
      );
      return;
    }
    try {
      await resetPassword(email);
      setResetMsg(
        `Te enviamos un email a ${email.trim()} con el link para resetear la contraseña.`
      );
    } catch {
      setError("No pudimos enviar el email. Verificá la dirección.");
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-brand-border bg-surface p-6 shadow-sm">
        <h1 className="text-xl font-bold text-primary">
          {mode === "login" ? "Ingresar" : "Crear cuenta"}
        </h1>
        <p className="mt-1 text-sm text-brand-dark/60">
          {mode === "login"
            ? "Usá tu usuario y contraseña, o entrá con Google."
            : "Registrate con tu email para hacer pedidos y ver tus precios."}
        </p>

        {mode === "login" ? (
          <form onSubmit={handleEmail} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium">Usuario</label>
              <input
                type="text"
                required
                autoCapitalize="none"
                autoCorrect="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario"
                className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 outline-none focus:border-primary"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium">Contraseña</label>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Olvidé mi contraseña
                </button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 outline-none focus:border-primary"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900">
                {error}
              </p>
            )}
            {resetMsg && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                ✓ {resetMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || !hydrated}
              className="w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {busy ? "Ingresando…" : "Ingresar"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium">Nombre</label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre o el del comercio"
                className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Email</label>
              <input
                type="email"
                required
                autoCapitalize="none"
                autoCorrect="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
                className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Contraseña</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 outline-none focus:border-primary"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || !hydrated}
              className="w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {busy ? "Creando cuenta…" : "Crear cuenta"}
            </button>
          </form>
        )}

        <div className="my-5 flex items-center gap-3 text-xs text-brand-dark/40">
          <span className="h-px flex-1 bg-brand-border" />o<span className="h-px flex-1 bg-brand-border" />
        </div>

        <button
          onClick={() => signInGoogle().then(() => router.push("/"))}
          className="w-full rounded-lg border border-brand-border px-4 py-2.5 font-medium hover:bg-primary-light"
        >
          Continuar con Google
        </button>

        <p className="mt-5 text-center text-sm text-brand-dark/70">
          {mode === "login" ? (
            <>
              ¿No tenés cuenta?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError("");
                  setResetMsg(null);
                }}
                className="font-semibold text-primary hover:underline"
              >
                Crear cuenta
              </button>
            </>
          ) : (
            <>
              ¿Ya tenés cuenta?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                className="font-semibold text-primary hover:underline"
              >
                Ingresar
              </button>
            </>
          )}
        </p>

        <p className="mt-4 text-center text-sm text-brand-dark/60">
          No necesitás cuenta para hacer un pedido —{" "}
          <Link href="/catalogo" className="font-medium text-primary underline">
            ver el catálogo
          </Link>
        </p>
      </div>
    </div>
  );
}
