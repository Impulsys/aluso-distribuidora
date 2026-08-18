"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_PRECIOS_CONFIG,
  subscribePreciosConfig,
  savePreciosConfig,
  type PreciosConfig,
  type ListaPrecio,
} from "@/lib/preciosConfig";
import { MARKUP_DISTRIBUIDOR } from "@/lib/precios";

export default function AdminPreciosPage() {
  const [cfg, setCfg] = useState<PreciosConfig>(DEFAULT_PRECIOS_CONFIG);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribePreciosConfig((c) => {
      setCfg(c);
      setLoading(false);
    });
    return unsub;
  }, []);

  const flash = (t: string) => {
    setMsg(t);
    setTimeout(() => setMsg(null), 1600);
  };

  const guardar = async (patch: Partial<PreciosConfig>) => {
    try {
      await savePreciosConfig(patch);
      flash("✓ Guardado");
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar.");
    }
  };

  // --- Listas ---
  const setLista = (i: number, campo: keyof ListaPrecio, valor: string) => {
    const listas = cfg.listas.map((l, k) =>
      k === i
        ? { ...l, [campo]: campo === "markup" ? Number(valor) || 0 : valor }
        : l
    );
    setCfg({ ...cfg, listas });
  };
  const addLista = () =>
    setCfg({ ...cfg, listas: [...cfg.listas, { nombre: "Nueva", markup: 0 }] });
  const delLista = (i: number) =>
    setCfg({ ...cfg, listas: cfg.listas.filter((_, k) => k !== i) });

  // --- Descuentos ---
  const setDesc = (campo: keyof PreciosConfig, valor: string) =>
    setCfg({ ...cfg, [campo]: Number(valor) || 0 });

  if (loading)
    return <p className="py-8 text-center text-brand-dark/60">Cargando…</p>;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 font-serif text-2xl font-medium text-brand-dark">
          <span className="text-3xl">🏷️</span> Precios y descuentos
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-brand-dark/60">
          Todo lo que arma el precio, editable desde acá. Las <b>listas</b> son
          el porcentaje que cada cliente lleva sobre el costo (la de{" "}
          {MARKUP_DISTRIBUIDOR}% es la que ve el público). Los <b>descuentos</b>{" "}
          se aplican en el remito según cómo se cierre la venta.
        </p>
      </div>

      {msg && (
        <div className="fixed right-4 top-20 z-20 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-lg">
          {msg}
        </div>
      )}

      {/* ===== LISTAS ===== */}
      <section className="mb-8 rounded-2xl border border-brand-border bg-surface p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-bold text-primary">
          Listas de precios
        </h2>
        <p className="mb-4 text-xs text-brand-dark/55">
          Cada cliente se asigna a una lista desde Usuarios. El precio del
          catálogo = costo + este %.
        </p>
        <div className="space-y-2">
          {cfg.listas.map((l, i) => {
            const esDistribuidor = l.markup === MARKUP_DISTRIBUIDOR;
            return (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={l.nombre}
                  onChange={(e) => setLista(i, "nombre", e.target.value)}
                  className="flex-1 rounded-lg border border-brand-border px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.5"
                    value={l.markup}
                    onChange={(e) => setLista(i, "markup", e.target.value)}
                    className="w-20 rounded-lg border border-brand-border px-2 py-2 text-center text-sm outline-none focus:border-primary"
                  />
                  <span className="text-sm text-brand-dark/50">%</span>
                </div>
                {esDistribuidor ? (
                  <span
                    className="w-8 text-center text-xs text-brand-dark/35"
                    title="La lista pública. No se borra."
                  >
                    ●
                  </span>
                ) : (
                  <button
                    onClick={() => delLista(i)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-rose-600 hover:bg-rose-50"
                    aria-label="Borrar lista"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={addLista}
            className="rounded-lg border border-dashed border-brand-border px-3 py-1.5 text-sm text-brand-dark/70 hover:border-primary hover:text-primary"
          >
            + Agregar lista
          </button>
          <button
            onClick={() => guardar({ listas: cfg.listas })}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-primary-dark"
          >
            Guardar listas
          </button>
        </div>
      </section>

      {/* ===== DESCUENTOS ===== */}
      <section className="rounded-2xl border border-brand-border bg-surface p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-bold text-primary">
          Descuentos por condición de venta
        </h2>
        <p className="mb-4 text-xs text-brand-dark/55">
          Se aplican en el remito, sobre el precio de la lista, según cómo pague
          y retire el cliente.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            label="Pago en efectivo"
            value={cfg.descuentoEfectivoPct}
            onChange={(v) => setDesc("descuentoEfectivoPct", v)}
            suffix="%"
          />
          <Campo
            label="Retira en depósito"
            value={cfg.descuentoRetiroPct}
            onChange={(v) => setDesc("descuentoRetiroPct", v)}
            suffix="%"
          />
          <Campo
            label="Por volumen"
            value={cfg.descuentoVolumenPct}
            onChange={(v) => setDesc("descuentoVolumenPct", v)}
            suffix="%"
          />
          <Campo
            label="Mínimo de bultos para el volumen"
            value={cfg.volumenMinBultos}
            onChange={(v) => setDesc("volumenMinBultos", v)}
            suffix="bultos"
          />
        </div>
        <p className="mt-4 rounded-lg bg-primary-light/40 px-3 py-2 text-xs text-brand-dark/70">
          Los descuentos se aplican <b>sucesivos</b> (uno sobre otro), como los
          hace ALUSO. Ej: 2,5% y 3% = × 0,975 × 0,97, no 5,5%.
        </p>
        <button
          onClick={() =>
            guardar({
              descuentoEfectivoPct: cfg.descuentoEfectivoPct,
              descuentoRetiroPct: cfg.descuentoRetiroPct,
              descuentoVolumenPct: cfg.descuentoVolumenPct,
              volumenMinBultos: cfg.volumenMinBultos,
            })
          }
          className="mt-4 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          Guardar descuentos
        </button>
      </section>

      {/* ===== COMISIONES ===== */}
      <section className="mt-8 rounded-2xl border border-brand-border bg-surface p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-bold text-primary">
          Comisiones de vendedores
        </h2>
        <p className="mb-4 text-xs text-brand-dark/55">
          Valores por defecto. Cada vendedor puede tener su propio % desde
          Usuarios. El reporte de comisiones está en su propia sección.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            label="Comisión por defecto del vendedor"
            value={cfg.comisionDefaultPct}
            onChange={(v) => setDesc("comisionDefaultPct", v)}
            suffix="%"
          />
          <Campo
            label="Override del reclutador (sobre lo que vende el reclutado)"
            value={cfg.overridePct}
            onChange={(v) => setDesc("overridePct", v)}
            suffix="%"
          />
        </div>
        <button
          onClick={() =>
            guardar({
              comisionDefaultPct: cfg.comisionDefaultPct,
              overridePct: cfg.overridePct,
            })
          }
          className="mt-4 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          Guardar comisiones
        </button>
      </section>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
  suffix: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-brand-dark">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-1">
        <input
          type="number"
          step="0.5"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-brand-border px-3 py-2 outline-none focus:border-primary"
        />
        <span className="whitespace-nowrap text-sm text-brand-dark/50">
          {suffix}
        </span>
      </div>
    </div>
  );
}
