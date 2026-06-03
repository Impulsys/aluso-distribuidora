"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  subscribeRemitosRange,
  anularRemito,
  mensajeVentaError,
} from "@/lib/ventas";
import { printRemito } from "@/lib/remito-print";
import { printReporteCaja } from "@/lib/reporte-caja-print";
import {
  subscribeProveedores,
  subscribeSupplierPaymentsRange,
} from "@/lib/cuentas";
import { subscribeExpensesRange } from "@/lib/cashflow";
import { setCashInitial, type DailyCashInitial } from "@/lib/cash-initial";
import {
  DENOMINACIONES,
  totalArqueo,
  cerrarCaja,
  reabrirCaja,
  subscribeCierre,
} from "@/lib/caja";
import { formatARS, formatDate } from "@/lib/format";
import {
  EXPENSE_LABELS,
  type DailyExpense,
  type Proveedor,
  type Remito,
  type SupplierPayment,
} from "@/lib/types";

function todayISO() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t.toISOString().slice(0, 10);
}

// ISO (YYYY-MM-DD) a partir de un timestamp, usando componentes locales.
function isoDeTs(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function CajaView() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin";
  const [dia, setDia] = useState(todayISO());

  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [pagos, setPagos] = useState<SupplierPayment[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [gastos, setGastos] = useState<DailyExpense[]>([]);
  const [cierre, setCierre] = useState<DailyCashInitial | null>(null);

  // Rango del día (con componentes para evitar problemas de zona horaria)
  const { start, end, dayTs } = useMemo(() => {
    const [y, m, d] = dia.split("-").map(Number);
    const s = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
    return { start: s, end: s + 86_400_000 - 1, dayTs: s };
  }, [dia]);

  useEffect(() => subscribeProveedores(setProveedores), []);

  // Solo los movimientos del día seleccionado (no toda la colección).
  useEffect(() => {
    const finDia = start + 86_400_000;
    const u1 = subscribeRemitosRange(start, finDia, setRemitos);
    const u2 = subscribeSupplierPaymentsRange(start, finDia, setPagos);
    const u3 = subscribeExpensesRange(start, finDia, setGastos);
    const u4 = subscribeCierre(dayTs, setCierre);
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [start, end, dayTs]);

  // ---- Datos del día ----
  const d = useMemo(() => {
    const remitosDia = remitos
      .filter((r) => r.fecha >= start && r.fecha <= end)
      .sort((a, b) => b.fecha - a.fecha);
    const pagosDia = pagos
      .filter((p) => p.fecha >= start && p.fecha <= end)
      .sort((a, b) => b.fecha - a.fecha);

    // Las ventas anuladas no cuentan (pero se siguen mostrando en la lista).
    const validos = remitosDia.filter((r) => !r.anulado);
    const ventas = validos.reduce((s, r) => s + r.total, 0);
    const ventaEfectivo = validos
      .filter((r) => (r.formaPago ?? "efectivo") === "efectivo")
      .reduce((s, r) => s + r.total, 0);
    const ventaTransfer = validos
      .filter((r) => r.formaPago === "transferencia")
      .reduce((s, r) => s + r.total, 0);
    const ventaCheque = validos
      .filter((r) => r.formaPago === "cheque")
      .reduce((s, r) => s + r.total, 0);

    const gastosTotal = gastos.reduce((s, g) => s + g.monto, 0);
    const gastosEfectivo = gastos
      .filter((g) => g.formaPago === "efectivo")
      .reduce((s, g) => s + g.monto, 0);

    const pagosTotal = pagosDia.reduce((s, p) => s + p.monto, 0);
    const pagosEfectivo = pagosDia
      .filter((p) => p.via === "efectivo")
      .reduce((s, p) => s + p.monto, 0);

    const disponible = ventas - gastosTotal - pagosTotal;
    const cajaInicial = cierre?.cajaInicial ?? 0;
    const efectivoEsperado =
      cajaInicial + ventaEfectivo - gastosEfectivo - pagosEfectivo;

    return {
      remitosDia,
      pagosDia,
      ventas,
      ventaEfectivo,
      ventaTransfer,
      ventaCheque,
      gastosTotal,
      gastosEfectivo,
      pagosTotal,
      pagosEfectivo,
      disponible,
      cajaInicial,
      efectivoEsperado,
    };
  }, [remitos, pagos, gastos, cierre, start, end]);

  const cerrado = cierre?.cerrado ?? false;
  const proveedorById = useMemo(
    () => Object.fromEntries(proveedores.map((p) => [p.id, p.nombre])),
    [proveedores]
  );

  const handleAnular = async (r: Remito) => {
    if (
      !confirm(
        `¿Anular la venta ${r.numero}? Se devuelve el stock al depósito.`
      )
    )
      return;
    try {
      await anularRemito(r, user?.uid);
    } catch (e) {
      console.error(e);
      alert(mensajeVentaError(e));
    }
  };

  return (
    <div className="space-y-4">
      {/* Selector de día */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-xl text-brand-dark">
          Caja del día{cerrado && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold uppercase text-slate-700">Cerrada</span>}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              printReporteCaja({
                fecha: dayTs,
                ventas: d.ventas,
                ventaEfectivo: d.ventaEfectivo,
                ventaTransfer: d.ventaTransfer,
                ventaCheque: d.ventaCheque,
                gastosTotal: d.gastosTotal,
                pagosTotal: d.pagosTotal,
                disponible: d.disponible,
                cajaInicial: d.cajaInicial,
                efectivoEsperado: d.efectivoEsperado,
                efectivoContado: cierre?.efectivoContado ?? null,
                diferencia: cierre?.diferencia ?? null,
                cerrado,
                cerradoPor: cierre?.cerradoPor,
              })
            }
            className="rounded-lg border border-brand-border bg-surface px-3 py-2 text-sm font-medium text-brand-dark hover:bg-primary-light"
          >
            🖨️ Imprimir reporte
          </button>
          <input
            type="date"
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            className="rounded-lg border border-brand-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* KPIs del flujo */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Ventas del día" value={d.ventas} tone="emerald" />
        <Kpi label="Gastos del día" value={-d.gastosTotal} tone="rose" />
        <Kpi label="Pagos a proveedores" value={-d.pagosTotal} tone="rose" />
        <Kpi label="Disponible a depositar" value={d.disponible} tone="primary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Columna izquierda: movimientos */}
        <div className="space-y-4">
          <Movimientos
            remitos={d.remitosDia}
            gastos={gastos}
            pagos={d.pagosDia}
            proveedorById={proveedorById}
            onAnular={handleAnular}
          />
        </div>

        {/* Columna derecha: pago a proveedor + cierre */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-brand-border bg-surface p-4">
            <h3 className="mb-1 font-serif text-lg text-brand-dark">
              Pago / depósito a proveedor
            </h3>
            <p className="text-sm text-brand-dark/60">
              Los pagos y depósitos a proveedores se registran en{" "}
              <span className="font-medium">Cuentas Ctes</span>, con todas las
              vías (depósito con billetes, transferencia, financiera con
              interés), modalidad A/B y reparto del sobrante. Ahí baja la deuda.
            </p>
            <Link
              href="/admin/cuentas"
              className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              Ir a registrar pago / depósito →
            </Link>
          </div>
          <CierreCaja
            d={d}
            cierre={cierre}
            cerrado={cerrado}
            isSuperadmin={isSuperadmin}
            dayTs={dayTs}
            createdBy={user?.displayName ?? user?.uid}
            onIrADia={setDia}
          />
        </div>
      </div>
    </div>
  );
}

// ==================== Movimientos ====================
function Movimientos({
  remitos,
  gastos,
  pagos,
  proveedorById,
  onAnular,
}: {
  remitos: Remito[];
  gastos: DailyExpense[];
  pagos: SupplierPayment[];
  proveedorById: Record<string, string>;
  onAnular: (r: Remito) => void;
}) {
  return (
    <div className="rounded-2xl border border-brand-border bg-surface p-4">
      <h3 className="mb-2 font-serif text-lg text-brand-dark">
        Movimientos del día
      </h3>

      <p className="mb-1 text-[11px] font-bold uppercase text-emerald-700">
        Ventas (remitos)
      </p>
      {remitos.length === 0 ? (
        <p className="mb-3 text-xs text-brand-dark/45">Sin ventas.</p>
      ) : (
        <div className="mb-3 divide-y divide-brand-border rounded-lg border border-brand-border">
          {remitos.map((r) => (
            <div
              key={r.id}
              className={`flex items-center justify-between gap-2 px-3 py-2 text-sm ${
                r.anulado ? "bg-rose-50/50" : ""
              }`}
            >
              <span className="min-w-0 truncate">
                <b className={r.anulado ? "text-brand-dark/50 line-through" : ""}>
                  {r.numero}
                </b>{" "}
                <span className="text-brand-dark/55">
                  {r.formaPago ?? "efectivo"}
                  {r.clienteNombre ? ` · ${r.clienteNombre}` : ""}
                </span>
                {r.anulado && (
                  <span className="ml-1 rounded-full bg-rose-100 px-1.5 text-[9px] font-bold uppercase text-rose-700">
                    anulada
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span
                  className={`font-semibold ${
                    r.anulado
                      ? "text-brand-dark/40 line-through"
                      : "text-emerald-700"
                  }`}
                >
                  {formatARS(r.total)}
                </span>
                <button
                  onClick={() => printRemito(r)}
                  className="text-xs text-primary hover:underline"
                  title="Imprimir"
                >
                  🖨️
                </button>
                {!r.anulado && (
                  <button
                    onClick={() => onAnular(r)}
                    className="text-xs text-rose-600 hover:underline"
                    title="Anular venta (devuelve stock)"
                  >
                    Anular
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="mb-1 text-[11px] font-bold uppercase text-rose-700">
        Gastos
      </p>
      {gastos.length === 0 ? (
        <p className="mb-3 text-xs text-brand-dark/45">Sin gastos.</p>
      ) : (
        <div className="mb-3 divide-y divide-brand-border rounded-lg border border-brand-border">
          {gastos.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <span className="text-brand-dark/75">
                {EXPENSE_LABELS[g.tipo]}{" "}
                <span className="text-brand-dark/45">· {g.formaPago}</span>
              </span>
              <span className="font-semibold text-rose-700">
                -{formatARS(g.monto)}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="mb-1 text-[11px] font-bold uppercase text-brand-dark/55">
        Pagos a proveedores
      </p>
      {pagos.length === 0 ? (
        <p className="text-xs text-brand-dark/45">Sin pagos.</p>
      ) : (
        <div className="divide-y divide-brand-border rounded-lg border border-brand-border">
          {pagos.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate text-brand-dark/75">
                {proveedorById[p.proveedorId] ?? "Proveedor"}
                {p.modalidad ? ` · ${p.modalidad}` : ""}{" "}
                <span className="text-brand-dark/45">· {p.via ?? "—"}</span>
              </span>
              <span className="shrink-0 font-semibold text-rose-700">
                -{formatARS(p.monto)}
                {p.comisionMonto ? (
                  <span className="ml-1 text-[10px] text-amber-700">
                    (+{formatARS(p.comisionMonto)} com.)
                  </span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== Cierre de caja (arqueo) ====================
function CierreCaja({
  d,
  cierre,
  cerrado,
  isSuperadmin,
  dayTs,
  createdBy,
  onIrADia,
}: {
  d: {
    ventaEfectivo: number;
    gastosEfectivo: number;
    pagosEfectivo: number;
    cajaInicial: number;
    efectivoEsperado: number;
  };
  cierre: DailyCashInitial | null;
  cerrado: boolean;
  isSuperadmin: boolean;
  dayTs: number;
  createdBy?: string;
  onIrADia: (iso: string) => void;
}) {
  const [arqueo, setArqueo] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [cajaIniInput, setCajaIniInput] = useState("");

  // Prefill arqueo y caja inicial desde el cierre guardado
  useEffect(() => {
    setArqueo(cierre?.arqueo ?? {});
    setCajaIniInput(String(cierre?.cajaInicial ?? 0));
  }, [cierre, dayTs]);

  const contado = totalArqueo(arqueo);
  const diferencia = contado - d.efectivoEsperado;

  const cerrar = async () => {
    if (!confirm("¿Cerrar la caja del día? Quedará bloqueada.")) return;
    setBusy(true);
    try {
      await cerrarCaja(dayTs, {
        arqueo,
        efectivoEsperado: d.efectivoEsperado,
        cerradoPor: createdBy,
      });
    } catch (e) {
      console.error(e);
      alert("No se pudo cerrar la caja.");
    } finally {
      setBusy(false);
    }
  };

  const reabrir = async () => {
    if (!confirm("¿Reabrir la caja de este día?")) return;
    try {
      await reabrirCaja(dayTs);
    } catch {
      alert("No se pudo reabrir.");
    }
  };

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary-light/30 to-surface p-4">
      <h3 className="mb-3 font-serif text-lg text-primary">🏦 Cierre de caja</h3>

      {/* Caja inicial */}
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="text-brand-dark/70">Caja inicial del día</span>
        {cerrado ? (
          <span className="font-medium">{formatARS(d.cajaInicial)}</span>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-brand-dark/50">$</span>
            <input
              type="number"
              min={0}
              value={cajaIniInput}
              onChange={(e) => setCajaIniInput(e.target.value)}
              onBlur={() =>
                setCashInitial(dayTs, Number(cajaIniInput) || 0, createdBy)
              }
              className="w-28 rounded-md border border-brand-border bg-white px-2 py-1 text-right text-sm outline-none focus:border-primary"
            />
          </div>
        )}
      </div>

      {/* Arqueo por denominación */}
      <p className="mb-1 text-[11px] font-bold uppercase text-brand-dark/55">
        Arqueo (contá los billetes)
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {DENOMINACIONES.map((den) => (
          <div
            key={den}
            className="flex items-center gap-1 rounded-lg border border-brand-border bg-white px-2 py-1"
          >
            <span className="w-16 text-xs text-brand-dark/60">
              {formatARS(den)}
            </span>
            <span className="text-brand-dark/30">×</span>
            <input
              type="number"
              min={0}
              disabled={cerrado}
              value={arqueo[den] || ""}
              onChange={(e) =>
                setArqueo((prev) => ({
                  ...prev,
                  [den]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                }))
              }
              className="w-full rounded border border-brand-border px-1.5 py-0.5 text-right text-sm outline-none focus:border-primary disabled:bg-slate-50"
              placeholder="0"
            />
          </div>
        ))}
      </div>

      {/* Totales del cierre */}
      <div className="mt-3 space-y-1 border-t border-brand-border pt-2 text-sm">
        <Row label="Efectivo esperado" value={d.efectivoEsperado} />
        <Row label="Efectivo contado" value={contado} bold />
        <Row
          label="Diferencia"
          value={diferencia}
          bold
          tone={diferencia === 0 ? "neutral" : diferencia > 0 ? "emerald" : "rose"}
        />
      </div>
      <p className="mt-1 text-[10px] text-brand-dark/45">
        Esperado = caja inicial + ventas en efectivo − gastos en efectivo − pagos
        en efectivo.
      </p>

      {cerrado ? (
        <div className="mt-3">
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
            Caja cerrada
            {cierre?.cerradoAt ? ` el ${formatDate(cierre.cerradoAt)}` : ""}.
          </p>
          <button
            onClick={() => onIrADia(isoDeTs(dayTs + 86_400_000))}
            className="mt-2 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Abrir la caja del día siguiente →
          </button>
          <p className="mt-1 text-center text-[10px] text-brand-dark/45">
            También podés elegir cualquier fecha con el selector de arriba.
          </p>
          {isSuperadmin && (
            <button
              onClick={reabrir}
              className="mt-2 w-full rounded-lg border border-brand-border px-4 py-2 text-sm font-medium hover:bg-primary-light"
            >
              Reabrir caja
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={cerrar}
          disabled={busy}
          className="mt-3 w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {busy ? "Cerrando…" : "Cerrar caja del día"}
        </button>
      )}
    </div>
  );
}

// ==================== UI helpers ====================
function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "rose" | "primary";
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "rose"
      ? "text-rose-700"
      : "text-primary";
  return (
    <div className="rounded-2xl border border-brand-border bg-surface p-4 shadow-sm">
      <p className="text-[11px] uppercase tracking-wider text-brand-dark/55">
        {label}
      </p>
      <p className={`mt-1 font-serif text-2xl font-medium ${color}`}>
        {value === 0
          ? "—"
          : value < 0
          ? `-${formatARS(Math.abs(value))}`
          : formatARS(value)}
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  tone = "neutral",
}: {
  label: string;
  value: number;
  bold?: boolean;
  tone?: "neutral" | "emerald" | "rose";
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "rose"
      ? "text-rose-700"
      : "text-brand-dark";
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-medium text-brand-dark" : "text-brand-dark/70"}>
        {label}
      </span>
      <span className={`${bold ? "font-bold" : "font-medium"} ${color}`}>
        {value < 0 ? `-${formatARS(Math.abs(value))}` : formatARS(value)}
      </span>
    </div>
  );
}
