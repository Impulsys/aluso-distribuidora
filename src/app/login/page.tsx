"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { usernameToEmail } from "@/lib/userAdmin";

export default function LoginPage() {
  const { signInEmail, signInGoogle, resetPassword, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  if (user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-lg">
          Ya ingresaste como <b>{user.displayName}</b>.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded bg-primary px-4 py-2 font-medium text-white"
        >
          Ir al catálogo
        </Link>
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
      router.push("/");
    } catch {
      setError("Usuario o contraseña incorrectos.");
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
        <h1 className="text-xl font-bold text-primary">Ingresar</h1>
        <p className="mt-1 text-sm text-brand-dark/60">
          Usá tu usuario y contraseña, o entrá con Google.
        </p>

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
            disabled={busy}
            className="w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {busy ? "Ingresando…" : "Ingresar"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-brand-dark/40">
          <span className="h-px flex-1 bg-brand-border" />o<span className="h-px flex-1 bg-brand-border" />
        </div>

        <button
          onClick={() => signInGoogle().then(() => router.push("/"))}
          className="w-full rounded-lg border border-brand-border px-4 py-2.5 font-medium hover:bg-primary-light"
        >
          Continuar con Google
        </button>

        <p className="mt-6 text-center text-sm text-brand-dark/60">
          No necesitás cuenta para hacer un pedido —{" "}
          <Link href="/catalogo" className="font-medium text-primary underline">
            ver el catálogo
          </Link>
        </p>
      </div>
    </div>
  );
}
