"use client";

import { useEffect, useState } from "react";
import {
  subscribeIaConfig,
  saveIaConfig,
  guardarClaveOpenAI,
  borrarClaveOpenAI,
  DEFAULT_IA_CONFIG,
  type IaConfig,
} from "@/lib/iaConfig";

const MODELOS = [
  { id: "gpt-4o", label: "GPT-4o (mejor lectura, un poco más caro)" },
  { id: "gpt-4o-mini", label: "GPT-4o mini (más barato, buena lectura)" },
];

export default function ConfiguracionIaPage() {
  const [cfg, setCfg] = useState<IaConfig>(DEFAULT_IA_CONFIG);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState("");

  useEffect(() => {
    const unsub = subscribeIaConfig((c) => {
      setCfg(c);
      setLoading(false);
    });
    return unsub;
  }, []);

  const flash = (m: string) => {
    setOk(m);
    setTimeout(() => setOk(""), 2500);
  };

  const guardarClave = async () => {
    if (!apiKey.trim()) return;
    setBusy(true);
    try {
      await guardarClaveOpenAI(apiKey);
      setApiKey("");
      flash("Clave guardada ✓");
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar la clave.");
    } finally {
      setBusy(false);
    }
  };

  const borrarClave = async () => {
    if (!confirm("¿Borrar la API key cargada? El módulo queda sin credencial."))
      return;
    setBusy(true);
    try {
      await borrarClaveOpenAI();
      flash("Clave borrada.");
    } catch (e) {
      console.error(e);
      alert("No se pudo borrar la clave.");
    } finally {
      setBusy(false);
    }
  };

  const setCampo = async (patch: Partial<IaConfig>) => {
    setCfg((c) => ({ ...c, ...patch }));
    try {
      await saveIaConfig(patch);
    } catch (e) {
      console.error(e);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary";

  if (loading) {
    return <p className="text-sm text-brand-dark/50">Cargando…</p>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-brand-dark">Configuración de IA</h2>
        <p className="text-sm text-brand-dark/60">
          El módulo de IA usa <b>tu propia cuenta de OpenAI</b>: vos cargás tu API
          key y el consumo lo paga tu cuenta. La clave se guarda de forma segura y
          solo la usa el servidor — nunca se muestra ni se expone en la app.
        </p>
      </div>

      {/* Estado de la clave */}
      <div className="rounded-2xl border border-brand-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-brand-dark">API key de OpenAI</h3>
          {cfg.tieneClave ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
              ✓ Clave cargada
            </span>
          ) : (
            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800">
              Sin clave
            </span>
          )}
        </div>

        <label className="block text-sm">
          <span className="font-medium text-brand-dark">
            {cfg.tieneClave ? "Reemplazar clave" : "Pegá tu API key"}
          </span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className={`mt-1 ${inputCls}`}
            autoComplete="off"
          />
          <span className="mt-1 block text-[11px] text-brand-dark/45">
            La generás en platform.openai.com → API keys. Por seguridad no se puede
            volver a leer desde acá: si la perdés, cargá una nueva.
          </span>
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={guardarClave}
            disabled={busy || !apiKey.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {busy ? "Guardando…" : "Guardar clave"}
          </button>
          {cfg.tieneClave && (
            <button
              onClick={borrarClave}
              disabled={busy}
              className="rounded-lg border border-brand-border px-4 py-2 text-sm font-medium hover:bg-rose-50 hover:text-rose-700"
            >
              Borrar clave
            </button>
          )}
        </div>
      </div>

      {/* Ajustes */}
      <div className="rounded-2xl border border-brand-border bg-surface p-4 space-y-4">
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-medium text-brand-dark">
              Módulo de IA habilitado
            </span>
            <span className="block text-[11px] text-brand-dark/45">
              Prendelo cuando la clave esté cargada y probada.
            </span>
          </span>
          <input
            type="checkbox"
            checked={cfg.habilitada}
            disabled={!cfg.tieneClave}
            onChange={(e) => setCampo({ habilitada: e.target.checked })}
            className="h-5 w-5"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium text-brand-dark">Modelo</span>
          <select
            value={cfg.modelo}
            onChange={(e) => setCampo({ modelo: e.target.value })}
            className={`mt-1 ${inputCls}`}
          >
            {MODELOS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        💡 El consumo de IA lo cobra OpenAI a tu cuenta. Leer una factura por foto
        cuesta centavos de dólar por imagen. Podés poner un límite de gasto mensual
        en tu panel de OpenAI (Billing → limits).
      </div>

      {ok && <p className="text-sm font-medium text-emerald-700">{ok}</p>}
    </div>
  );
}
