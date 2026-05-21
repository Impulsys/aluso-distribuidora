"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_REPORTES_CONFIG,
  saveReportesConfig,
  subscribeReportesConfig,
  type ReportesConfig,
} from "@/lib/config";

const TOGGLES: {
  key: keyof ReportesConfig;
  label: string;
  hint: string;
}[] = [
  {
    key: "mostrarGananciaASocios",
    label: "Mostrar % y ganancia del camión",
    hint: "Si lo desactivás, los socios no ven el porcentaje de ganancia asignado ni el monto estimado/real.",
  },
  {
    key: "mostrarGastosASocios",
    label: "Mostrar gastos detallados del día",
    hint: "Las 7 categorías de gastos (impuestos, sueldos, fletes, etc).",
  },
  {
    key: "mostrarCajaFisicaASocios",
    label: "Mostrar Caja física y depósito a banco",
    hint: "Cuánto efectivo queda en mano y cuánto se deposita.",
  },
  {
    key: "mostrarCargaCamionASocios",
    label: "Mostrar carga de productos del camión",
    hint: "Listado de qué productos y cantidades trajo cada camión.",
  },
];

export default function AdminConfiguracionPage() {
  const [cfg, setCfg] = useState<ReportesConfig>(DEFAULT_REPORTES_CONFIG);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const unsub = subscribeReportesConfig((c) => {
      setCfg(c);
      setLoading(false);
    });
    return unsub;
  }, []);

  const toggle = async (k: keyof ReportesConfig) => {
    const next = { ...cfg, [k]: !cfg[k] };
    setCfg(next);
    setBusy(true);
    setSuccess(false);
    try {
      await saveReportesConfig({ [k]: next[k] });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 1500);
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar.");
      setCfg(cfg); // revertir
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return <p className="py-8 text-center text-brand-dark/60">Cargando…</p>;

  return (
    <div className="max-w-2xl">
      <p className="mb-6 text-sm text-brand-dark/65">
        Configurá qué partes del reporte ven los <b>Socios administradores</b>{" "}
        cuando entran a Reportes. Vos como superadmin siempre ves todo.
      </p>

      {success && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          ✓ Configuración guardada
        </div>
      )}

      <div className="space-y-3">
        {TOGGLES.map((t) => (
          <article
            key={t.key}
            className="flex items-start justify-between gap-4 rounded-xl border border-brand-border bg-surface p-4 transition hover:shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-brand-dark">{t.label}</h3>
              <p className="mt-1 text-xs text-brand-dark/55">{t.hint}</p>
            </div>
            <button
              role="switch"
              aria-checked={cfg[t.key]}
              disabled={busy}
              onClick={() => toggle(t.key)}
              className={`relative inline-flex h-7 w-12 flex-none items-center rounded-full transition ${
                cfg[t.key] ? "bg-primary" : "bg-slate-300"
              } disabled:opacity-60`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                  cfg[t.key] ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
