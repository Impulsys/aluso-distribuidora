"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  subscribeLicencia,
  setLicencia,
  servicioHabilitado,
  OWNER_EMAIL,
  type Licencia,
} from "@/lib/licencia";
import { formatDate } from "@/lib/format";

export default function AdminSistemaPage() {
  const { user } = useAuth();
  const [lic, setLic] = useState<Licencia | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => subscribeLicencia(setLic), []);

  // Solo el dueño (proveedor) ve este panel.
  if (user && user.email !== OWNER_EMAIL) {
    return (
      <div className="rounded-2xl border border-brand-border bg-surface p-8 text-center text-brand-dark/60">
        No tenés acceso a esta sección.
      </div>
    );
  }

  const habilitado = servicioHabilitado(lic);
  const vence = lic?.vencimiento ?? null;
  const diasRestantes = vence
    ? Math.ceil((vence - Date.now()) / 86_400_000)
    : null;

  const aplicar = async (patch: Partial<Licencia>, texto: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await setLicencia(patch);
      setMsg(texto);
    } catch (e) {
      console.error(e);
      setMsg("No se pudo cambiar. ¿Estás logueado con tu cuenta de proveedor?");
    } finally {
      setBusy(false);
    }
  };

  const activarDias = (dias: number) =>
    aplicar(
      { activa: true, vencimiento: Date.now() + dias * 86_400_000 },
      `✅ Activado por ${dias} días.`
    );

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="font-serif text-2xl text-brand-dark">Sistema (privado)</h1>
        <p className="text-sm text-brand-dark/60">
          Control del servicio. Solo lo ves y lo cambiás vos ({OWNER_EMAIL}).
        </p>
      </div>

      {/* Estado actual */}
      <div
        className={`rounded-2xl border-2 p-5 ${
          habilitado
            ? "border-emerald-200 bg-emerald-50"
            : "border-rose-200 bg-rose-50"
        }`}
      >
        <p className="text-[11px] uppercase tracking-wider text-brand-dark/55">
          Estado del servicio
        </p>
        <p
          className={`mt-1 font-serif text-2xl font-medium ${
            habilitado ? "text-emerald-700" : "text-rose-700"
          }`}
        >
          {habilitado ? "✅ Habilitado" : "🔒 Bloqueado"}
        </p>
        <p className="mt-2 text-sm text-brand-dark/70">
          {lic?.vencimiento
            ? `Vence el ${formatDate(lic.vencimiento)}${
                diasRestantes !== null
                  ? ` · ${diasRestantes} día${diasRestantes === 1 ? "" : "s"} restantes`
                  : ""
              }`
            : lic?.activa === false
            ? "Bloqueado manualmente."
            : "Sin vencimiento (permanente)."}
        </p>
      </div>

      {/* Acciones */}
      <div className="rounded-2xl border border-brand-border bg-surface p-5">
        <p className="mb-3 text-sm font-medium text-brand-dark">Acciones</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => activarDias(15)}
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            Activar 15 días
          </button>
          <button
            onClick={() => activarDias(30)}
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            Activar 30 días
          </button>
          <button
            onClick={() =>
              aplicar(
                { activa: true, vencimiento: null },
                "✅ Activado sin vencimiento (pagado total)."
              )
            }
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Activar permanente (pagó todo)
          </button>
          <button
            onClick={() => {
              if (confirm("¿Bloquear el servicio ahora?"))
                aplicar({ activa: false }, "🔒 Servicio bloqueado.");
            }}
            disabled={busy}
            className="rounded-lg border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          >
            Bloquear ahora
          </button>
        </div>
        {msg && (
          <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-brand-dark">
            {msg}
          </p>
        )}
        <p className="mt-3 text-[11px] text-brand-dark/45">
          Esta pantalla no aparece en el menú; entrás por la URL{" "}
          <code>/admin/sistema</code>. El cliente no la ve ni puede cambiar el
          estado.
        </p>
      </div>
    </div>
  );
}
