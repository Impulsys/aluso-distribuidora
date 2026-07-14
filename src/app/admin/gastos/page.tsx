"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createExpense,
  updateExpense,
  deleteExpense,
  subscribeExpensesRange,
  getLastExpenseDate,
} from "@/lib/cashflow";
import { formatARS, formatDate, formatGasto, tsFromISO } from "@/lib/format";
import {
  EXPENSE_LABELS,
  type DailyExpense,
  type ExpenseType,
  type FormaPago,
} from "@/lib/types";

const FORMAS: { id: FormaPago; label: string; emoji: string }[] = [
  { id: "efectivo", label: "Efectivo", emoji: "💵" },
  { id: "cheque", label: "Cheque", emoji: "🧾" },
  { id: "transferencia", label: "Transferencia", emoji: "🏦" },
];

const EXPENSE_TYPES: ExpenseType[] = [
  "impuestos",
  "insumos",
  "mantenimiento",
  "sueldos",
  "fletes",
  "cobertura_cheques",
  "adelantos",
];

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function monthRange(d: Date) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  return { start, end };
}

function dayRange(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  return { start, end: start + 86_400_000 };
}

function isoDeTs(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function AdminGastosPage() {
  const [fecha, setFecha] = useState(todayISO());
  const [tipo, setTipo] = useState<ExpenseType>("insumos");
  const [monto, setMonto] = useState<number>(0);
  const [formaPago, setFormaPago] = useState<FormaPago>("efectivo");
  const [detalle, setDetalle] = useState("");
  const [editId, setEditId] = useState<string | null>(null); // id del egreso en edición
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Vista: por día (default) o por mes
  const [vista, setVista] = useState<"dia" | "mes">("dia");
  const [dia, setDia] = useState(todayISO());
  const [refDate, setRefDate] = useState(new Date());
  const [gastos, setGastos] = useState<DailyExpense[]>([]);

  // Al entrar, posicionar el día en el último que tenga egresos (si hay).
  useEffect(() => {
    getLastExpenseDate()
      .then((ts) => {
        if (ts) setDia(isoDeTs(ts));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const { start, end } =
      vista === "mes" ? monthRange(refDate) : dayRange(dia);
    const unsub = subscribeExpensesRange(start, end, setGastos);
    return unsub;
  }, [vista, refDate, dia]);

  const totales = useMemo(() => {
    const total = gastos.reduce((s, g) => s + g.monto, 0);
    const porTipo: Record<string, number> = {};
    const porForma: Record<FormaPago, number> = {
      efectivo: 0,
      cheque: 0,
      transferencia: 0,
    };
    gastos.forEach((g) => {
      porTipo[g.tipo] = (porTipo[g.tipo] ?? 0) + g.monto;
      porForma[g.formaPago] += g.monto;
    });
    return { total, porTipo, porForma };
  }, [gastos]);

  // Tipos a mostrar en el resumen: los 7 manuales + cualquier tipo extra
  // (ej. "comision_agencia", generado automáticamente) que tenga monto.
  const tiposResumen = useMemo<ExpenseType[]>(() => {
    const extra = (Object.keys(EXPENSE_LABELS) as ExpenseType[]).filter(
      (t) => !EXPENSE_TYPES.includes(t) && (totales.porTipo[t] ?? 0) > 0
    );
    return [...EXPENSE_TYPES, ...extra];
  }, [totales]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (monto <= 0) {
      setError("El monto del egreso debe ser mayor a 0.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const dayTs = tsFromISO(fecha);
      const data = {
        fecha: dayTs,
        tipo,
        monto: Number(monto),
        formaPago,
        detalle: detalle.trim() || undefined,
      };
      if (editId) {
        await updateExpense(editId, data);
      } else {
        await createExpense(data);
      }
      setMonto(0);
      setDetalle("");
      setEditId(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e) {
      console.error(e);
      setError("No se pudo guardar el egreso.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este egreso?")) return;
    try {
      await deleteExpense(id);
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar.");
    }
  };

  const startEdit = (g: DailyExpense) => {
    setEditId(g.id);
    setTipo(g.tipo);
    setMonto(g.monto);
    setFormaPago(g.formaPago);
    setDetalle(g.detalle ?? "");
    setFecha(isoDeTs(g.fecha));
    setError(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditId(null);
    setMonto(0);
    setDetalle("");
    setError(null);
  };

  const monthLabel = refDate.toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
      {/* === Form === */}
      <section className="rounded-2xl border border-brand-border bg-surface p-5">
        <h2 className="font-serif text-xl text-brand-dark">
          {editId ? "Editar egreso" : "Nuevo egreso"}
        </h2>
        <p className="mt-1 text-xs text-brand-dark/55">
          {editId
            ? "Modificá los datos y guardá los cambios."
            : "Se imputa al día seleccionado y al tipo elegido."}
        </p>

        <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-brand-dark/70">
              Tipo de gasto
            </span>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as ExpenseType)}
              className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {EXPENSE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EXPENSE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-brand-dark/70">
              Monto (ARS)
            </span>
            <input
              type="number"
              min={0}
              step={100}
              value={monto || ""}
              onChange={(e) => setMonto(Number(e.target.value))}
              required
              className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>

          <div>
            <span className="mb-1 block text-xs font-medium text-brand-dark/70">
              Forma de pago
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {FORMAS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormaPago(f.id)}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                    formaPago === f.id
                      ? "border-primary bg-primary text-white"
                      : "border-brand-border bg-surface hover:border-primary"
                  }`}
                >
                  <div className="text-lg">{f.emoji}</div>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-brand-dark/70">
              Fecha
            </span>
            <input
              type="date"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-brand-dark/70">
              Detalle (opcional)
            </span>
            <textarea
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              rows={2}
              placeholder="Ej: Factura proveedor X, Sueldo Joaquín…"
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
              ✓ Egreso {editId ? "actualizado" : "registrado"}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {busy
                ? "Guardando…"
                : editId
                ? "Guardar cambios"
                : "Registrar egreso"}
            </button>
            {editId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg border border-brand-border px-4 py-2.5 text-sm font-medium hover:bg-primary-light"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      {/* === Lista del mes === */}
      <section>
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Switch Día / Mes */}
            <div className="inline-flex rounded-full border border-brand-border bg-surface p-1 text-sm">
              {(["dia", "mes"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setVista(v)}
                  className={`rounded-full px-3 py-1 font-medium transition ${
                    vista === v
                      ? "bg-primary text-white"
                      : "text-brand-dark/70 hover:bg-primary-light"
                  }`}
                >
                  {v === "dia" ? "Por día" : "Por mes"}
                </button>
              ))}
            </div>

            {vista === "dia" ? (
              <input
                type="date"
                value={dia}
                onChange={(e) => setDia(e.target.value)}
                className="rounded-lg border border-brand-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
              />
            ) : (
              <div className="inline-flex items-center gap-1 rounded-full border border-brand-border bg-surface p-1">
                <button
                  onClick={() =>
                    setRefDate(
                      new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1)
                    )
                  }
                  className="grid h-8 w-8 place-items-center rounded-full hover:bg-primary-light"
                >
                  ←
                </button>
                <span className="px-3 font-serif text-base font-medium text-brand-dark first-letter:uppercase">
                  {monthLabel}
                </span>
                <button
                  onClick={() =>
                    setRefDate(
                      new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1)
                    )
                  }
                  className="grid h-8 w-8 place-items-center rounded-full hover:bg-primary-light"
                >
                  →
                </button>
              </div>
            )}
          </div>
          <span className="text-sm font-medium text-brand-dark">
            {vista === "dia" ? "Total del día" : "Total del mes"}:{" "}
            <b className="text-primary">{formatARS(totales.total)}</b>
          </span>
        </header>

        {/* Resumen por tipo */}
        {gastos.length > 0 && (
          <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-brand-border bg-primary-light/30 p-3 sm:grid-cols-4">
            {tiposResumen.map((t) => (
              <div key={t} className="text-xs">
                <p className="text-brand-dark/55">{EXPENSE_LABELS[t]}</p>
                <p className="font-semibold text-brand-dark">
                  {formatARS(totales.porTipo[t] ?? 0)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Lista */}
        {gastos.length === 0 ? (
          <div className="rounded-xl border border-brand-border bg-surface p-8 text-center text-brand-dark/60">
            {vista === "dia"
              ? `Sin egresos el ${formatDate(dayRange(dia).start)}.`
              : `Sin egresos cargados en ${monthLabel}.`}
          </div>
        ) : (
          <div className="space-y-2">
            {gastos.map((g) => (
              <article
                key={g.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-brand-border bg-surface p-3 transition hover:shadow-md"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                      {EXPENSE_LABELS[g.tipo]}
                    </span>
                    <span className="text-[11px] text-brand-dark/55">
                      {formatDate(g.fecha)} · {g.formaPago}
                    </span>
                  </div>
                  {g.detalle && (
                    <p className="mt-1 line-clamp-1 text-sm text-brand-dark">
                      {g.detalle}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`font-semibold ${
                      g.monto < 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {formatGasto(g.monto)}
                  </span>
                  <button
                    onClick={() => startEdit(g)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(g.id)}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Eliminar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
