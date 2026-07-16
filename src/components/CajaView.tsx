"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { subscribeExpensesRange, createExpense } from "@/lib/cashflow";
import { setCashInitial, type DailyCashInitial } from "@/lib/cash-initial";
import {
  DENOMINACIONES,
  totalArqueo,
  cerrarCaja,
  reabrirCaja,
  subscribeCierre,
  guardarArqueoParcial,
  pagoUsaEfectivo,
  efectivoEsperadoDelDia,
} from "@/lib/caja";
import { formatARS, formatDate, formatGasto } from "@/lib/format";
import {
  EXPENSE_LABELS,
  type DailyExpense,
  type ExpenseType,
  type FormaPago,
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
  // true cuando ya llegó el primer snapshot del cierre de ESE día (para no
  // pisar los billetes que el usuario está cargando).
  const [cierreListo, setCierreListo] = useState(false);

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
    setCierreListo(false);
    const u1 = subscribeRemitosRange(start, finDia, setRemitos);
    const u2 = subscribeSupplierPaymentsRange(start, finDia, setPagos);
    const u3 = subscribeExpensesRange(start, finDia, setGastos);
    const u4 = subscribeCierre(dayTs, (c) => {
      setCierre(c);
      setCierreListo(true);
    });
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
    // Todos los pagos con billetes físicos (depósito, agencia, efectivo…) salen
    // de la caja, no solo los de vía "efectivo".
    const pagosEfectivo = pagosDia
      .filter(pagoUsaEfectivo)
      .reduce((s, p) => s + p.monto, 0);

    const disponible = ventas - gastosTotal - pagosTotal;
    const cajaInicial = cierre?.cajaInicial ?? 0;
    const efectivoEsperado = efectivoEsperadoDelDia({
      cajaInicial,
      ventaEfectivo,
      gastos,
      pagos: pagosDia,
    });

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
    // Con la caja YA cerrada, anular una venta cambia el efectivo esperado del
    // día y el arqueo firmado queda descuadrado para siempre. Hay que reabrir.
    if (cerrado) {
      alert(
        "La caja de este día ya está cerrada.\n\n" +
          "Anular ahora descuadraría el arqueo que ya firmaron. " +
          (isSuperadmin
            ? "Reabrí la caja, anulá la venta y volvé a cerrar."
            : "Pedile a un superadmin que reabra la caja.")
      );
      return;
    }
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
            cerrado={cerrado}
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
          <GastoDelDia dayTs={dayTs} createdBy={user?.uid} />
          <CierreCaja
            d={d}
            cierre={cierre}
            cierreListo={cierreListo}
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
  cerrado,
}: {
  remitos: Remito[];
  gastos: DailyExpense[];
  pagos: SupplierPayment[];
  proveedorById: Record<string, string>;
  onAnular: (r: Remito) => void;
  cerrado: boolean;
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
                    disabled={cerrado}
                    className="text-xs text-rose-600 hover:underline disabled:cursor-not-allowed disabled:text-brand-dark/25 disabled:no-underline"
                    title={
                      cerrado
                        ? "Caja cerrada: reabrí la caja para poder anular"
                        : "Anular venta (devuelve stock)"
                    }
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
              <span
                className={`font-semibold ${
                  g.monto < 0 ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {formatGasto(g.monto)}
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
                    ({p.comisionMonto > 0 ? "+" : ""}
                    {formatARS(p.comisionMonto)} com.)
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

// ==================== Gasto del día (sueldo, flete, etc.) ====================
function GastoDelDia({
  dayTs,
  createdBy,
}: {
  dayTs: number;
  createdBy?: string;
}) {
  const [tipo, setTipo] = useState<ExpenseType>("sueldos");
  const [monto, setMonto] = useState("");
  const [formaPago, setFormaPago] = useState<FormaPago>("efectivo");
  const [detalle, setDetalle] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState("");

  const agregar = async () => {
    const m = Number(monto) || 0;
    if (m <= 0) {
      alert("Poné el monto del gasto.");
      return;
    }
    setBusy(true);
    try {
      await createExpense({
        fecha: dayTs,
        tipo,
        monto: m,
        formaPago,
        detalle: detalle.trim() || undefined,
        createdBy,
      });
      setMonto("");
      setDetalle("");
      setOk("Gasto cargado ✓");
      setTimeout(() => setOk(""), 2000);
    } catch (e) {
      console.error(e);
      alert("No se pudo cargar el gasto.");
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-brand-border bg-white px-2 py-1.5 text-sm outline-none focus:border-primary";

  return (
    <div className="rounded-2xl border border-brand-border bg-surface p-4">
      <h3 className="mb-1 font-serif text-lg text-brand-dark">Gasto del día</h3>
      <p className="mb-3 text-xs text-brand-dark/55">
        Cargá acá los gastos (sueldos, fletes, etc.). Se suman al cierre de la caja.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium text-brand-dark/70">
          Tipo
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as ExpenseType)}
            className={inputCls}
          >
            {(Object.keys(EXPENSE_LABELS) as ExpenseType[]).map((t) => (
              <option key={t} value={t}>
                {EXPENSE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-brand-dark/70">
          Monto
          <input
            type="number"
            min={0}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0"
            className={`${inputCls} text-right`}
          />
        </label>
        <label className="text-xs font-medium text-brand-dark/70">
          Forma de pago
          <select
            value={formaPago}
            onChange={(e) => setFormaPago(e.target.value as FormaPago)}
            className={inputCls}
          >
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="cheque">Cheque</option>
          </select>
        </label>
        <label className="text-xs font-medium text-brand-dark/70">
          Detalle (opcional)
          <input
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            placeholder="Ej: Joaquín / flete Mafe"
            className={inputCls}
          />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={agregar}
          disabled={busy}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
        >
          {busy ? "Guardando…" : "＋ Agregar gasto"}
        </button>
        {ok && <span className="text-sm font-medium text-emerald-700">{ok}</span>}
      </div>
    </div>
  );
}

// ==================== Cierre de caja (arqueo) ====================
function CierreCaja({
  d,
  cierre,
  cierreListo,
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
  cierreListo: boolean;
  cerrado: boolean;
  isSuperadmin: boolean;
  dayTs: number;
  createdBy?: string;
  onIrADia: (iso: string) => void;
}) {
  const [arqueo, setArqueo] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [cajaIniInput, setCajaIniInput] = useState("");
  // Cuánto queda en el cajón para mañana. Acá la recaudación se retira casi
  // siempre (banco / caja fuerte), así que el default es $0.
  const [quedaInput, setQuedaInput] = useState("0");
  const prefillDia = useRef<number | null>(null);

  // Prefill del arqueo/caja inicial: SOLO la primera vez que carga el día.
  // ANTES se re-ejecutaba con cada cambio del doc (ej. al guardar la caja
  // inicial) y BORRABA los billetes que el usuario estaba cargando.
  useEffect(() => {
    if (!cierreListo) return;
    if (prefillDia.current === dayTs) return;
    prefillDia.current = dayTs;
    setArqueo(cierre?.arqueo ?? {});
    setCajaIniInput(String(cierre?.cajaInicial ?? 0));
    setQuedaInput(String(cierre?.quedaEnCaja ?? 0));
  }, [cierre, cierreListo, dayTs]);

  // AUTOSAVE del arqueo: los billetes se guardan solos mientras se cargan.
  // Antes vivían solo en memoria y se perdían al cambiar de pestaña o recargar
  // (la caja terminaba cerrándose en $0).
  useEffect(() => {
    if (!cierreListo || cerrado) return;
    if (prefillDia.current !== dayTs) return; // aún no cargó este día
    const t = setTimeout(() => {
      guardarArqueoParcial(dayTs, arqueo).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [arqueo, cierreListo, cerrado, dayTs]);

  // Arranque del día de HOY. ¿El día que estoy mirando todavía no llegó?
  const hoy0 = useMemo(() => {
    const h = new Date();
    h.setHours(0, 0, 0, 0);
    return h.getTime();
  }, []);
  const esFuturo = dayTs > hoy0;

  // Caja inicial EN VIVO (lo que está tipeado), no la del snapshot: si no, al
  // cerrar se guardaba un "esperado" sin la caja inicial recién cargada.
  const cajaIniActual = Number(cajaIniInput) || 0;
  const esperadoVivo =
    cajaIniActual + d.ventaEfectivo - d.gastosEfectivo - d.pagosEfectivo;
  const contadoVivo = totalArqueo(arqueo);
  const quedaActual = Math.max(0, Math.min(Number(quedaInput) || 0, contadoVivo));
  const retiroActual = contadoVivo - quedaActual;

  // Si la caja está CERRADA mostramos los números GUARDADOS (no recalculados),
  // para que pantalla, reporte impreso y registro histórico coincidan siempre.
  const esperado = cerrado ? cierre?.efectivoEsperado ?? 0 : esperadoVivo;
  const contado = cerrado ? cierre?.efectivoContado ?? 0 : contadoVivo;
  const diferencia = cerrado
    ? cierre?.diferencia ?? 0
    : contadoVivo - esperadoVivo;

  const cerrar = async () => {
    // NO se cierra la caja de un día que todavía no pasó. El 13/07/2026 el
    // cliente apretó "Abrir la caja del día siguiente" y cerró ahí mismo el 14
    // (vacío, en $0): al otro día la caja aparecía CERRADA y no podía cargar
    // los billetes.
    if (esFuturo) {
      alert(
        "Ese día todavía no llegó: no se puede cerrar la caja de un día futuro.\n\n" +
          "Volvé al día de hoy con el selector de arriba."
      );
      return;
    }
    // Red de seguridad: no cerrar en $0 si hubo ventas en efectivo.
    if (contadoVivo === 0 && esperadoVivo > 0) {
      if (
        !confirm(
          `⚠️ Estás cerrando con $0 contado, pero se esperaban ${formatARS(
            esperadoVivo
          )} en efectivo.\n\n¿Cargaste los billetes? Si seguís, la caja queda en cero.\n\n¿Cerrar igual?`
        )
      )
        return;
    }
    if (
      !confirm(
        `¿Cerrar la caja del día? Quedará bloqueada.\n\n` +
          `Contado: ${formatARS(contadoVivo)}\n` +
          `Queda en el cajón para mañana: ${formatARS(quedaActual)}\n` +
          `Se retira (banco / caja fuerte): ${formatARS(retiroActual)}`
      )
    )
      return;
    setBusy(true);
    try {
      // Persistir la caja inicial tipeada ANTES de cerrar (evita guardar un
      // "esperado" viejo si el usuario cerró sin salir del campo).
      await setCashInitial(dayTs, cajaIniActual, createdBy);
      await cerrarCaja(dayTs, {
        arqueo,
        efectivoEsperado: esperadoVivo,
        quedaEnCaja: quedaActual,
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
              disabled={!cierreListo}
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
        {DENOMINACIONES.map((den) => {
          const cant = arqueo[den] || 0;
          return (
            <div
              key={den}
              className="flex items-center gap-1 rounded-lg border border-brand-border bg-white px-2 py-1"
            >
              <span className="w-14 shrink-0 text-xs text-brand-dark/60">
                {formatARS(den)}
              </span>
              <span className="text-brand-dark/30">×</span>
              <input
                type="number"
                min={0}
                disabled={cerrado || !cierreListo}
                value={arqueo[den] || ""}
                onChange={(e) =>
                  setArqueo((prev) => ({
                    ...prev,
                    [den]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                  }))
                }
                className="w-12 rounded border border-brand-border px-1.5 py-0.5 text-right text-sm outline-none focus:border-primary disabled:bg-slate-50"
                placeholder="0"
              />
              <span className="ml-auto text-xs font-semibold tabular-nums text-brand-dark/70">
                {cant > 0 ? formatARS(den * cant) : ""}
              </span>
            </div>
          );
        })}
      </div>

      {/* Total del arqueo — va sumando en vivo */}
      <div className="mt-2 flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
        <span className="text-sm font-bold text-primary">Total en billetes</span>
        <span className="text-xl font-extrabold tabular-nums text-primary">
          {formatARS(contado)}
        </span>
      </div>

      {/* Totales del cierre */}
      <div className="mt-3 space-y-1 border-t border-brand-border pt-2 text-sm">
        <Row label="Efectivo esperado" value={esperado} />
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

      {/* ¿Qué se hace con la plata contada? Lo que NO queda en el cajón se
          considera retirado (banco / caja fuerte) y NO se arrastra a mañana. */}
      {!cerrado ? (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50/70 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-900">
            ¿Cuánta plata queda en el cajón para mañana?
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm font-semibold text-amber-900">$</span>
            <input
              type="number"
              min={0}
              disabled={!cierreListo}
              value={quedaInput}
              onChange={(e) => setQuedaInput(e.target.value)}
              className="w-36 rounded border border-amber-300 bg-white px-2 py-1 text-right text-sm font-semibold outline-none focus:border-amber-500 disabled:bg-slate-50"
              placeholder="0"
            />
            <button
              type="button"
              onClick={() => setQuedaInput("0")}
              className="rounded-lg bg-amber-200 px-2.5 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-300"
            >
              No queda nada
            </button>
            <button
              type="button"
              onClick={() => setQuedaInput(String(contadoVivo))}
              className="rounded-lg bg-amber-200 px-2.5 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-300"
            >
              Queda todo
            </button>
          </div>
          <p className="mt-2 text-[11px] text-amber-900/80">
            Se retira (banco / caja fuerte):{" "}
            <b className="tabular-nums">{formatARS(retiroActual)}</b> · Mañana la
            caja arranca con <b className="tabular-nums">{formatARS(quedaActual)}</b>.
          </p>
        </div>
      ) : null}

      {cerrado ? (
        <div className="mt-3">
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
            Caja cerrada
            {cierre?.cerradoAt ? ` el ${formatDate(cierre.cerradoAt)}` : ""}.
            {(cierre?.retirado ?? 0) > 0 && (
              <>
                {" "}
                Se retiraron <b>{formatARS(cierre?.retirado ?? 0)}</b> y quedaron{" "}
                <b>{formatARS(cierre?.quedaEnCaja ?? 0)}</b> en el cajón.
              </>
            )}
          </p>
          {/* Solo si ese "día siguiente" ya llegó. Si cerrás la caja de HOY,
              este botón te llevaba a MAÑANA — y ahí se podía cerrar una caja
              vacía por adelantado, dejándola bloqueada al otro día. */}
          {dayTs + 86_400_000 <= hoy0 && (
            <button
              onClick={() => onIrADia(isoDeTs(dayTs + 86_400_000))}
              className="mt-2 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Abrir la caja del día siguiente →
            </button>
          )}
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
          disabled={busy || !cierreListo || esFuturo}
          title={
            esFuturo ? "Ese día todavía no llegó" : "Cerrar la caja de este día"
          }
          className="mt-3 w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy
            ? "Cerrando…"
            : esFuturo
            ? "Este día todavía no llegó"
            : !cierreListo
            ? "Cargando caja…"
            : "Cerrar caja del día"}
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
