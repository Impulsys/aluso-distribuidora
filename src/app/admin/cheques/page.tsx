"use client";

import { useEffect, useMemo, useState } from "react";
import {
  chequesProximos,
  chequesVencidos,
  createCheck,
  deleteCheck,
  subscribeChecks,
  updateCheckStatus,
} from "@/lib/cashflow";
import {
  formatARS,
  formatDate,
  daysBetween,
  isoFromTs,
  tsFromISO,
} from "@/lib/format";
import type { Check, CheckStatus } from "@/lib/types";

const STATUS_OPTIONS: CheckStatus[] = ["pendiente", "pagado", "rechazado"];

const STATUS_STYLES: Record<CheckStatus, string> = {
  pendiente: "bg-amber-100 text-amber-800 ring-amber-300",
  pagado: "bg-emerald-100 text-emerald-800 ring-emerald-300",
  rechazado: "bg-rose-100 text-rose-800 ring-rose-300",
};
const STATUS_LABEL: Record<CheckStatus, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  rechazado: "Rechazado",
};

// Hoy en hora LOCAL. Con toISOString() (UTC) después de las 21 hs argentinas el
// form arrancaba con la fecha de MAÑANA.
function todayISO() {
  return isoFromTs(Date.now());
}

/** Arranque del día de hoy (00:00 local). Las fechas de pago se guardan así. */
function inicioDeHoy(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function AdminChequesPage() {
  const [cheques, setCheques] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);

  // form
  const [numero, setNumero] = useState("");
  const [banco, setBanco] = useState("");
  const [monto, setMonto] = useState(0);
  const [fechaEmision, setFechaEmision] = useState(todayISO());
  const [fechaPago, setFechaPago] = useState(todayISO());
  const [beneficiario, setBeneficiario] = useState("");
  const [notas, setNotas] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const unsub = subscribeChecks((cs) => {
      setCheques(cs);
      setLoading(false);
    });
    return unsub;
  }, []);

  const hoy0 = useMemo(() => inicioDeHoy(), []);
  const alertas = useMemo(() => chequesProximos(cheques, 3), [cheques]);
  const vencidos = useMemo(() => chequesVencidos(cheques), [cheques]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (monto <= 0) {
      setError("El monto debe ser mayor a 0.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      await createCheck({
        numero: numero.trim(),
        banco: banco.trim(),
        monto: Number(monto),
        fechaEmision: tsFromISO(fechaEmision),
        fechaPago: tsFromISO(fechaPago),
        beneficiario: beneficiario.trim(),
        notas: notas.trim() || undefined,
      });
      setNumero("");
      setBanco("");
      setMonto(0);
      setBeneficiario("");
      setNotas("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e) {
      console.error(e);
      setError("No se pudo registrar el cheque.");
    } finally {
      setBusy(false);
    }
  };

  const handleStatus = async (id: string, status: CheckStatus) => {
    try {
      await updateCheckStatus(id, status);
    } catch (e) {
      console.error(e);
      alert("No se pudo actualizar.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar el cheque?")) return;
    try {
      await deleteCheck(id);
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar.");
    }
  };

  if (loading) {
    return <p className="py-8 text-center text-brand-dark/60">Cargando…</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
      {/* === Form === */}
      <section className="rounded-2xl border border-brand-border bg-surface p-5">
        <h2 className="font-serif text-xl text-brand-dark">Nuevo cheque</h2>
        <p className="mt-1 text-xs text-brand-dark/55">
          Vamos a alertarte 3 días antes de la fecha de pago.
        </p>

        <form onSubmit={handleCreate} className="mt-4 grid gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-brand-dark/70">
                Nº cheque
              </span>
              <input
                required
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="00012345"
                className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-brand-dark/70">
                Banco
              </span>
              <input
                required
                value={banco}
                onChange={(e) => setBanco(e.target.value)}
                placeholder="Galicia, Macro…"
                className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-brand-dark/70">
              Beneficiario
            </span>
            <input
              required
              value={beneficiario}
              onChange={(e) => setBeneficiario(e.target.value)}
              placeholder="Nombre / Razón social"
              className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-brand-dark/70">
              Monto (ARS)
            </span>
            <input
              required
              type="number"
              min={0}
              step={100}
              value={monto || ""}
              onChange={(e) => setMonto(Number(e.target.value))}
              className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-brand-dark/70">
                Fecha emisión
              </span>
              <input
                required
                type="date"
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
                className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-brand-dark/70">
                Fecha pago
              </span>
              <input
                required
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
                className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-brand-dark/70">
              Notas (opcional)
            </span>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              ✓ Cheque registrado
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {busy ? "Guardando…" : "Registrar cheque"}
          </button>
        </form>
      </section>

      {/* === Alertas + Lista === */}
      <section>
        {/* Alertas vencidos */}
        {vencidos.length > 0 && (
          <div className="mb-3 rounded-2xl border border-rose-300 bg-rose-50 p-4">
            <p className="text-sm font-bold text-rose-900">
              🚨 {vencidos.length} cheque{vencidos.length === 1 ? "" : "s"}{" "}
              vencido{vencidos.length === 1 ? "" : "s"} sin pagar
            </p>
            <p className="mt-1 text-xs text-rose-800">
              Revisalos abajo y marcalos como pagado o rechazado.
            </p>
          </div>
        )}
        {/* Alertas próximos */}
        {alertas.length > 0 && (
          <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-bold text-amber-900">
              ⚠️ {alertas.length} cheque{alertas.length === 1 ? "" : "s"} a
              vencer en los próximos 3 días
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              {alertas.map((c) => (
                <li key={c.id} className="flex justify-between text-amber-800">
                  <span>
                    #{c.numero} · {c.beneficiario}
                  </span>
                  <span>
                    {formatARS(c.monto)} ·{" "}
                    <b>
                      {daysBetween(Date.now(), c.fechaPago)} día
                      {daysBetween(Date.now(), c.fechaPago) === 1 ? "" : "s"}
                    </b>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <h2 className="mb-3 font-serif text-xl text-brand-dark">
          Todos los cheques
        </h2>

        {cheques.length === 0 ? (
          <div className="rounded-xl border border-brand-border bg-surface p-8 text-center text-brand-dark/60">
            Sin cheques registrados todavía.
          </div>
        ) : (
          <div className="space-y-2">
            {cheques.map((c) => {
              // Comparamos DÍA contra DÍA. Antes se comparaba contra Date.now(),
              // y como la fecha de pago se guarda a las 00:00, un cheque que
              // vencía HOY ya figuraba "vencido hace 0 días".
              const dias = Math.round((c.fechaPago - hoy0) / 86_400_000);
              const venceHoy = dias === 0;
              const futuro = dias > 0;
              return (
                <article
                  key={c.id}
                  className="rounded-xl border border-brand-border bg-surface p-4 transition hover:shadow-md"
                >
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-brand-dark/55">
                        #{c.numero}
                      </span>
                      <span className="text-xs font-medium text-brand-dark">
                        {c.banco}
                      </span>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${STATUS_STYLES[c.status]}`}
                    >
                      {STATUS_LABEL[c.status]}
                    </span>
                  </header>
                  <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <p className="font-semibold text-brand-dark">
                        {c.beneficiario}
                      </p>
                      <p className="text-xs text-brand-dark/60">
                        Emisión: {formatDate(c.fechaEmision)} · Pago:{" "}
                        {formatDate(c.fechaPago)}
                        {c.status === "pendiente" && (
                          <span
                            className={`ml-2 font-bold ${
                              venceHoy
                                ? "text-amber-700"
                                : futuro
                                  ? dias <= 3
                                    ? "text-amber-700"
                                    : "text-brand-dark/55"
                                  : "text-rose-700"
                            }`}
                          >
                            {venceHoy
                              ? "vence HOY"
                              : futuro
                                ? `en ${dias} día${dias === 1 ? "" : "s"}`
                                : `vencido hace ${-dias} día${-dias === 1 ? "" : "s"}`}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="font-bold text-primary">
                      {formatARS(c.monto)}
                    </span>
                  </div>
                  {c.notas && (
                    <p className="mt-2 text-xs italic text-brand-dark/55">
                      📝 {c.notas}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-brand-border pt-3">
                    <span className="text-xs text-brand-dark/50">
                      Cambiar estado:
                    </span>
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s}
                        disabled={c.status === s}
                        onClick={() => handleStatus(c.id, s)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition disabled:opacity-50 ${
                          c.status === s
                            ? `${STATUS_STYLES[s]} ring-inset`
                            : "bg-surface text-brand-dark/70 ring-brand-border hover:bg-primary-light"
                        }`}
                      >
                        {STATUS_LABEL[s]}
                      </button>
                    ))}
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="ml-auto text-xs text-rose-700 hover:underline"
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
