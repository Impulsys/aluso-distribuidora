"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import CuentaCorrienteView from "@/components/CuentaCorrienteView";
import {
  subscribeProveedores,
  subscribePurchases,
  subscribeSupplierPayments,
  seedProveedoresIfEmpty,
  createProveedor,
  createPayment,
  updatePayment,
  deleteProveedor,
  deletePurchase,
  deletePayment,
  saldoCompra,
} from "@/lib/cuentas";
import { recibirCamion, TruckValidationError } from "@/lib/trucks";
import { createExpense } from "@/lib/cashflow";
import { DENOMINACIONES, totalArqueo } from "@/lib/caja";
import { formatARS, tsFromISO } from "@/lib/format";
import {
  TRANSPORTES,
  type PagoVia,
  type Proveedor,
  type Purchase,
  type PurchaseModalidad,
  type SupplierPayment,
} from "@/lib/types";

// Vías de pago a proveedor (operativa)
type PagoViaSel = "deposito" | "transferencia" | "agencia" | "efectivo";
const VIA_LABELS: Record<PagoViaSel, string> = {
  deposito: "Depósito bancario",
  transferencia: "Transferencia",
  agencia: "Financiera / agencia",
  efectivo: "Efectivo",
};

function todayISO() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t.toISOString().slice(0, 10);
}

interface PagoOpts {
  via: PagoVia;
  comisionPct?: number;
  comisionMonto?: number;
  arqueoDeposito?: Record<string, number>;
  transferNumero?: string;
  transferBanco?: string;
  transferTitular?: string;
  depositoCuenta?: string;
  depositoTitular?: string;
}

const PRESET_COLORS = [
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#10B981",
  "#06B6D4",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#A16207",
  "#475569",
];

export default function AdminCuentasPage() {
  const { user } = useAuth();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);

  // Form: nuevo proveedor
  const [pNombre, setPNombre] = useState("");
  const [pCuit, setPCuit] = useState("");
  const [pContacto, setPContacto] = useState("");

  // Form: llegó un camión (compra)
  const [cProv, setCProv] = useState("");
  const [cNombre, setCNombre] = useState("");
  const [cColor, setCColor] = useState(PRESET_COLORS[5]);
  const [cPorcentaje, setCPorcentaje] = useState(35);
  const [cTransporte, setCTransporte] = useState<string>(TRANSPORTES[0]);
  const [cTransporteOtro, setCTransporteOtro] = useState("");
  const [cFecha, setCFecha] = useState(todayISO());
  const [cDescripcion, setCDescripcion] = useState("");
  const [cNumFacturaA, setCNumFacturaA] = useState("");
  const [cMontoA, setCMontoA] = useState(0);
  const [cNumRemitoB, setCNumRemitoB] = useState("");
  const [cMontoB, setCMontoB] = useState(0);
  const [cShowLogistica, setCShowLogistica] = useState(false);
  const [cLogistica, setCLogistica] = useState(0);
  const [cLogisticaDetalle, setCLogisticaDetalle] = useState("");
  const [cBusy, setCBusy] = useState(false);

  // Form: nuevo pago
  const [gProv, setGProv] = useState("");
  const [gMonto, setGMonto] = useState(0);
  const [gFecha, setGFecha] = useState(todayISO());
  const [gVia, setGVia] = useState<PagoViaSel>("transferencia");
  const [gModalidad, setGModalidad] = useState<PurchaseModalidad>("A");
  const [gComisionPct, setGComisionPct] = useState(4);
  const [gArqueo, setGArqueo] = useState<Record<string, number>>({});
  const [gShowArqueo, setGShowArqueo] = useState(false);
  const [gTransferNum, setGTransferNum] = useState("");
  const [gTransferBanco, setGTransferBanco] = useState("");
  const [gTransferTitular, setGTransferTitular] = useState("");
  const [gDepCuenta, setGDepCuenta] = useState("");
  const [gDepTitular, setGDepTitular] = useState("");
  const [gMsg, setGMsg] = useState<string | null>(null);
  const [gPurchase, setGPurchase] = useState(""); // "" = a cuenta

  const [error, setError] = useState<string | null>(null);
  // Camión recién creado → aviso para ir a cargar la mercadería
  const [creado, setCreado] = useState<string | null>(null);
  // Pago en edición (abre modal)
  const [editPago, setEditPago] = useState<SupplierPayment | null>(null);

  useEffect(() => {
    seedProveedoresIfEmpty().catch(() => {});
    const u1 = subscribeProveedores(setProveedores);
    const u2 = subscribePurchases(setPurchases);
    const u3 = subscribeSupplierPayments(setPayments);
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  // Compras del proveedor seleccionado en el form de pago (para imputar)
  const comprasDelProv = useMemo(
    () => purchases.filter((p) => p.proveedorId === gProv),
    [purchases, gProv]
  );

  const handleAddProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pNombre.trim()) return;
    setError(null);
    try {
      await createProveedor({
        nombre: pNombre.trim(),
        cuit: pCuit.trim() || undefined,
        contacto: pContacto.trim() || undefined,
      });
      setPNombre("");
      setPCuit("");
      setPContacto("");
    } catch (err) {
      console.error(err);
      setError("No se pudo crear el proveedor.");
    }
  };

  const handleRecibirCamion = async (e: React.FormEvent) => {
    e.preventDefault();
    const prov = proveedores.find((p) => p.id === cProv);
    if (!prov || !cNombre.trim()) {
      setError("Elegí un proveedor y poné un nombre al camión.");
      return;
    }
    setError(null);
    setCBusy(true);
    try {
      await recibirCamion({
        nombre: cNombre.trim(),
        color: cColor,
        fechaIngreso: tsFromISO(cFecha),
        porcentajeGanancia: Number(cPorcentaje) || 0,
        transporte: cTransporte,
        transporteOtro:
          cTransporte === "otro" ? cTransporteOtro.trim() : undefined,
        descripcion: cDescripcion.trim() || undefined,
        proveedorId: prov.id,
        proveedorNombre: prov.nombre,
        facturaA:
          cNumFacturaA.trim() && cMontoA > 0
            ? { numero: cNumFacturaA.trim(), monto: Number(cMontoA) }
            : undefined,
        remitoB:
          cNumRemitoB.trim() && cMontoB > 0
            ? { numero: cNumRemitoB.trim(), monto: Number(cMontoB) }
            : undefined,
        logistica: cShowLogistica && cLogistica > 0 ? Number(cLogistica) : undefined,
        logisticaDetalle: cShowLogistica
          ? cLogisticaDetalle.trim() || undefined
          : undefined,
        createdBy: user?.uid,
      });
      // Reset (mantiene proveedor, color, % y transporte para cargas seguidas)
      setCNombre("");
      setCDescripcion("");
      setCNumFacturaA("");
      setCMontoA(0);
      setCNumRemitoB("");
      setCMontoB(0);
      setCShowLogistica(false);
      setCLogistica(0);
      setCLogisticaDetalle("");
      // Aviso: el camión quedó creado; la mercadería se carga en Camiones.
      setCreado(cNombre.trim());
    } catch (err) {
      console.error(err);
      setError(
        err instanceof TruckValidationError
          ? err.message
          : "No se pudo registrar el camión."
      );
    } finally {
      setCBusy(false);
    }
  };

  // Comisión de la agencia (importe × %) — solo si la vía es "agencia".
  const comisionMonto =
    gVia === "agencia" ? (Number(gMonto) * Number(gComisionPct || 0)) / 100 : 0;

  // En transferencia no hay billetes; en depósito/financiera/efectivo sí (plata física).
  const usaBilletes = gVia !== "transferencia";

  // Arma el objeto de opciones de la operativa del pago (vía/comisión/arqueo/transfer).
  const buildOpts = (): PagoOpts => ({
    via: gVia,
    comisionPct: gVia === "agencia" ? Number(gComisionPct) || 0 : undefined,
    comisionMonto:
      gVia === "agencia" && comisionMonto !== 0 ? comisionMonto : undefined,
    arqueoDeposito:
      usaBilletes && totalArqueo(gArqueo) > 0 ? gArqueo : undefined,
    transferNumero:
      gVia === "transferencia" ? gTransferNum.trim() || undefined : undefined,
    transferBanco:
      gVia === "transferencia" ? gTransferBanco.trim() || undefined : undefined,
    transferTitular:
      gVia === "transferencia" ? gTransferTitular.trim() || undefined : undefined,
    depositoCuenta:
      gVia === "deposito" ? gDepCuenta.trim() || undefined : undefined,
    depositoTitular:
      gVia === "deposito" ? gDepTitular.trim() || undefined : undefined,
  });

  // Crea uno o varios pagos (cada línea imputada a un comprobante + sobrante a cuenta).
  const registrarPagos = async (
    lineas: { purchaseId?: string; monto: number }[],
    opts: PagoOpts
  ) => {
    const fecha = tsFromISO(gFecha);
    let primera = true;
    for (const l of lineas) {
      if (l.monto <= 0) continue;
      await createPayment({
        proveedorId: gProv,
        monto: l.monto,
        fecha,
        modalidad: gModalidad,
        via: opts.via,
        comisionPct: opts.comisionPct,
        comisionMonto: primera ? opts.comisionMonto : undefined,
        arqueoDeposito: primera ? opts.arqueoDeposito : undefined,
        transferNumero: primera ? opts.transferNumero : undefined,
        transferBanco: primera ? opts.transferBanco : undefined,
        transferTitular: primera ? opts.transferTitular : undefined,
        depositoCuenta: primera ? opts.depositoCuenta : undefined,
        depositoTitular: primera ? opts.depositoTitular : undefined,
        purchaseId: l.purchaseId,
        createdBy: user?.uid,
      });
      primera = false;
    }
    // Comisión de agencia → queda registrada como gasto financiero del día.
    // Puede ser positiva (costo) o negativa (descuento/reintegro).
    if (opts.comisionMonto && opts.comisionMonto !== 0) {
      await createExpense({
        fecha,
        tipo: "comision_agencia",
        monto: opts.comisionMonto,
        // La comisión sale por la MISMA vía del pago: si fuiste con billetes a
        // la agencia, es efectivo (y tiene que bajar de la caja).
        formaPago: opts.via === "transferencia" ? "transferencia" : "efectivo",
        detalle: `${
          opts.comisionMonto < 0 ? "Descuento financiera" : "Comisión agencia"
        } — pago a ${proveedores.find((p) => p.id === gProv)?.nombre ?? ""}`,
        createdBy: user?.uid,
      });
    }
    setGMonto(0);
    setGPurchase("");
    setGArqueo({});
    setGTransferNum("");
    setGTransferBanco("");
    setGTransferTitular("");
    setGDepCuenta("");
    setGDepTitular("");
    setGMsg("✓ Pago registrado con éxito.");
    setTimeout(() => setGMsg(null), 3000);
  };

  const handleAddPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gProv || gMonto <= 0) return;
    setError(null);
    setGMsg(null);

    const monto = Number(gMonto);
    const opts = buildOpts();
    const compraSel = gPurchase
      ? comprasDelProv.find((c) => c.id === gPurchase)
      : null;

    let lineas: { purchaseId?: string; monto: number }[];
    if (compraSel) {
      // El saldo no puede ser negativo: si el comprobante ya está saldado,
      // no se le imputa nada y el pago va a cuenta del proveedor.
      const saldo = Math.max(0, saldoCompra(compraSel, payments));
      if (saldo <= 0) {
        const ok = confirm(
          `El comprobante ${compraSel.modalidad} · ${compraSel.numero} ya está ` +
            `saldado. El pago de ${formatARS(monto)} quedará a cuenta del ` +
            `proveedor. ¿Registrar el pago?`
        );
        if (!ok) return;
        lineas = [{ purchaseId: undefined, monto }];
      } else if (monto > saldo + 0.001) {
        // Paga más que el saldo: imputa el saldo y el resto queda a cuenta.
        const excedente = monto - saldo;
        const ok = confirm(
          `El comprobante ${compraSel.modalidad} · ${compraSel.numero} debe ` +
            `${formatARS(saldo)}. Se imputan ${formatARS(saldo)} a ese ` +
            `comprobante y ${formatARS(excedente)} quedan a cuenta del ` +
            `proveedor. ¿Registrar el pago?`
        );
        if (!ok) return;
        lineas = [
          { purchaseId: compraSel.id, monto: saldo },
          { purchaseId: undefined, monto: excedente },
        ].filter((l) => l.monto > 0);
      } else {
        lineas = [{ purchaseId: compraSel.id, monto }];
      }
    } else {
      lineas = [{ purchaseId: undefined, monto }];
    }

    try {
      await registrarPagos(lineas, opts);
    } catch (err) {
      console.error(err);
      setError("No se pudo registrar el pago.");
    }
  };

  const handleDeletePurchase = async (id: string) => {
    if (!confirm("¿Eliminar esta compra?")) return;
    try {
      await deletePurchase(id);
    } catch {
      alert("No se pudo eliminar la compra.");
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!confirm("¿Eliminar este pago?")) return;
    try {
      await deletePayment(id);
    } catch {
      alert("No se pudo eliminar el pago.");
    }
  };

  const handleDeleteProveedor = async (id: string) => {
    const tieneMovimientos =
      purchases.some((p) => p.proveedorId === id) ||
      payments.some((p) => p.proveedorId === id);
    if (tieneMovimientos) {
      alert(
        "No se puede eliminar: el proveedor tiene compras o pagos registrados. Eliminá primero esos movimientos."
      );
      return;
    }
    const prov = proveedores.find((p) => p.id === id);
    if (!confirm(`¿Eliminar al proveedor "${prov?.nombre ?? ""}"?`)) return;
    try {
      await deleteProveedor(id);
    } catch {
      alert("No se pudo eliminar el proveedor.");
    }
  };

  const inputCls =
    "w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary";
  const labelCls =
    "mb-1 block text-[11px] font-bold uppercase tracking-wider text-brand-dark/55";

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      {/* === Formularios === */}
      <div className="space-y-4">
        {/* Nuevo proveedor */}
        <form
          onSubmit={handleAddProveedor}
          className="rounded-2xl border border-brand-border bg-surface p-4"
        >
          <h2 className="mb-3 font-serif text-lg text-brand-dark">
            Agregar proveedor
          </h2>
          <div className="space-y-2">
            <div>
              <label className={labelCls}>Nombre</label>
              <input
                required
                value={pNombre}
                onChange={(e) => setPNombre(e.target.value)}
                placeholder="Distribuidora XX SA"
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>CUIT (opcional)</label>
                <input
                  value={pCuit}
                  onChange={(e) => setPCuit(e.target.value)}
                  placeholder="30-..."
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Contacto (opcional)</label>
                <input
                  value={pContacto}
                  onChange={(e) => setPContacto(e.target.value)}
                  placeholder="Tel / referente"
                  className={inputCls}
                />
              </div>
            </div>
          </div>
          <button
            type="submit"
            className="mt-3 w-full rounded-lg bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-dark"
          >
            Agregar proveedor
          </button>
        </form>

        {/* Llegó un camión (compra) */}
        <form
          onSubmit={handleRecibirCamion}
          className="rounded-2xl border border-brand-border bg-surface p-4"
        >
          <h2 className="font-serif text-lg text-brand-dark">
            Llegó un camión
          </h2>
          <p className="mb-3 text-xs text-brand-dark/55">
            Registra la compra al proveedor y crea el camión. El camión activo
            anterior se cierra automáticamente.
          </p>
          <div className="space-y-2">
            <div>
              <label className={labelCls}>Proveedor</label>
              <select
                required
                value={cProv}
                onChange={(e) => setCProv(e.target.value)}
                className={inputCls}
              >
                <option value="">— Elegir —</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Nombre del camión</label>
              <input
                required
                value={cNombre}
                onChange={(e) => setCNombre(e.target.value)}
                placeholder="Camión #12"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Color de referencia</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={cColor}
                  onChange={(e) => setCColor(e.target.value)}
                  className="h-9 w-11 cursor-pointer rounded-lg border border-brand-border"
                />
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCColor(c)}
                      className={`h-6 w-6 rounded-full ring-2 transition ${
                        cColor === c
                          ? "scale-110 ring-brand-dark"
                          : "ring-transparent hover:ring-brand-dark/30"
                      }`}
                      style={{ background: c }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>% Ganancia</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={cPorcentaje}
                  onChange={(e) => setCPorcentaje(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Fecha de ingreso</label>
                <input
                  type="date"
                  value={cFecha}
                  onChange={(e) => setCFecha(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Transporte</label>
              <select
                value={cTransporte}
                onChange={(e) => setCTransporte(e.target.value)}
                className={inputCls}
              >
                {TRANSPORTES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value="otro">Otro…</option>
              </select>
              {cTransporte === "otro" && (
                <input
                  value={cTransporteOtro}
                  onChange={(e) => setCTransporteOtro(e.target.value)}
                  placeholder="Nombre del transportista"
                  className={`mt-2 ${inputCls}`}
                />
              )}
            </div>

            {/* Comprobantes (al menos uno) */}
            <div className="rounded-lg border border-brand-border bg-primary-light/20 p-3">
              <p className="mb-2 text-[11px] font-semibold text-brand-dark">
                Comprobante de la compra (al menos uno)
              </p>
              <div className="grid grid-cols-[1fr_110px] gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark/55">
                    Nº Factura (A · facturado)
                  </label>
                  <input
                    value={cNumFacturaA}
                    onChange={(e) => setCNumFacturaA(e.target.value)}
                    placeholder="0001-00001234"
                    className="w-full rounded-lg border border-brand-border bg-white px-2 py-1.5 text-xs outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark/55">
                    Monto
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={cMontoA || ""}
                    onChange={(e) => setCMontoA(Number(e.target.value))}
                    placeholder="0"
                    className="w-full rounded-lg border border-brand-border bg-white px-2 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark/55">
                    Nº Remito (B · sin facturar)
                  </label>
                  <input
                    value={cNumRemitoB}
                    onChange={(e) => setCNumRemitoB(e.target.value)}
                    placeholder="R-0001"
                    className="w-full rounded-lg border border-brand-border bg-white px-2 py-1.5 text-xs outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark/55">
                    Monto
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={cMontoB || ""}
                    onChange={(e) => setCMontoB(Number(e.target.value))}
                    placeholder="0"
                    className="w-full rounded-lg border border-brand-border bg-white px-2 py-1.5 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Logística (opcional) */}
            {!cShowLogistica ? (
              <button
                type="button"
                onClick={() => setCShowLogistica(true)}
                className="text-xs font-medium text-primary hover:underline"
              >
                ＋ Agregar gastos de logística
              </button>
            ) : (
              <div className="rounded-lg border border-brand-border bg-amber-50/60 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-brand-dark">
                    Gastos de logística (flete / descarga)
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCShowLogistica(false);
                      setCLogistica(0);
                      setCLogisticaDetalle("");
                    }}
                    className="text-[11px] text-brand-dark/60 hover:underline"
                  >
                    Quitar
                  </button>
                </div>
                <div className="grid grid-cols-[120px_1fr] gap-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark/55">
                      Monto
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={cLogistica || ""}
                      onChange={(e) => setCLogistica(Number(e.target.value))}
                      placeholder="0"
                      className="w-full rounded-lg border border-brand-border bg-white px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark/55">
                      Detalle (opcional)
                    </label>
                    <input
                      value={cLogisticaDetalle}
                      onChange={(e) => setCLogisticaDetalle(e.target.value)}
                      placeholder="Flete Mafe + descarga"
                      className="w-full rounded-lg border border-brand-border bg-white px-2 py-1.5 text-xs outline-none focus:border-primary"
                    />
                  </div>
                </div>
                <p className="mt-1 text-[10px] text-brand-dark/45">
                  Se descuenta de la ganancia real del camión en el reporte.
                </p>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={cBusy}
            className="mt-3 w-full rounded-lg bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {cBusy ? "Registrando…" : "Registrar camión + compra"}
          </button>

          {creado && (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs">
              <p className="font-semibold text-emerald-900">
                ✓ Camión “{creado}” creado y compra registrada.
              </p>
              <p className="mt-0.5 text-emerald-800/80">
                Ahora cargá la mercadería que trajo: poné cantidad y costo a cada
                producto y guardá. Eso suma el stock y alimenta el reporte.
              </p>
              <Link
                href="/admin/camiones"
                className="mt-2 inline-block rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700"
              >
                Cargar la mercadería del camión →
              </Link>
            </div>
          )}
        </form>

        {/* Nuevo pago */}
        <form
          onSubmit={handleAddPago}
          className="rounded-2xl border border-brand-border bg-surface p-4"
        >
          <h2 className="mb-3 font-serif text-lg text-brand-dark">
            Registrar pago
          </h2>
          <div className="space-y-2">
            <div>
              <label className={labelCls}>Proveedor</label>
              <select
                required
                value={gProv}
                onChange={(e) => {
                  setGProv(e.target.value);
                  setGPurchase("");
                }}
                className={inputCls}
              >
                <option value="">— Elegir —</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Imputar a</label>
              <select
                value={gPurchase}
                onChange={(e) => setGPurchase(e.target.value)}
                className={inputCls}
              >
                <option value="">Pago a cuenta (general)</option>
                {comprasDelProv.map((c) => {
                  const saldo = Math.max(0, saldoCompra(c, payments));
                  return (
                    <option key={c.id} value={c.id}>
                      {c.modalidad} · {c.numero} (
                      {c.camionNombre ?? "s/camión"}) —{" "}
                      {saldo > 0 ? `debe ${formatARS(saldo)}` : "saldado"}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Monto</label>
                <input
                  required
                  type="number"
                  min={1}
                  step="any"
                  value={gMonto || ""}
                  onChange={(e) => setGMonto(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Fecha</label>
                <input
                  type="date"
                  value={gFecha}
                  onChange={(e) => setGFecha(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Modalidad</label>
                <select
                  value={gModalidad}
                  onChange={(e) =>
                    setGModalidad(e.target.value as PurchaseModalidad)
                  }
                  className={inputCls}
                >
                  <option value="A">A (facturado)</option>
                  <option value="B">B (sin facturar)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Vía de pago</label>
                <select
                  value={gVia}
                  onChange={(e) => setGVia(e.target.value as PagoViaSel)}
                  className={inputCls}
                >
                  {(Object.keys(VIA_LABELS) as PagoViaSel[]).map((v) => (
                    <option key={v} value={v}>
                      {VIA_LABELS[v]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Depósito bancario → cuenta destino + titular */}
            {gVia === "deposito" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark/55">
                    Nº de cuenta / CBU destino
                  </label>
                  <input
                    value={gDepCuenta}
                    onChange={(e) => setGDepCuenta(e.target.value)}
                    placeholder="CBU o nº de cuenta"
                    className="w-full rounded-lg border border-brand-border bg-white px-2 py-1.5 text-xs outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark/55">
                    Titular de la cuenta
                  </label>
                  <input
                    value={gDepTitular}
                    onChange={(e) => setGDepTitular(e.target.value)}
                    placeholder="Titular"
                    className="w-full rounded-lg border border-brand-border bg-white px-2 py-1.5 text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>
            )}

            {/* Billetes: depósito / financiera / efectivo (plata física que se envía) */}
            {usaBilletes && (
              <button
                type="button"
                onClick={() => setGShowArqueo(true)}
                className="w-full rounded-lg border border-dashed border-brand-border px-3 py-2 text-xs font-medium text-primary hover:bg-primary-light/30"
              >
                {totalArqueo(gArqueo) > 0
                  ? `Billetes detallados: ${formatARS(totalArqueo(gArqueo))} — editar`
                  : "🧾 Detallar billetes que se envían (opcional)"}
              </button>
            )}

            {/* Agencia / financiera → % de comisión */}
            {gVia === "agencia" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark/55">
                  Comisión de la financiera (%) — negativa = descuento
                </label>
                <input
                  type="number"
                  step="any"
                  value={gComisionPct || ""}
                  onChange={(e) => setGComisionPct(Number(e.target.value))}
                  placeholder="4 (o -4 para restar)"
                  className="w-full rounded-lg border border-brand-border bg-white px-2 py-1.5 text-xs"
                />
                {gMonto > 0 && (
                  <p className="mt-1 text-[11px] text-brand-dark/70">
                    Comisión: <b>{formatARS(comisionMonto)}</b> · Te sale en
                    total: <b>{formatARS(Number(gMonto) + comisionMonto)}</b>{" "}
                    (la deuda baja {formatARS(Number(gMonto))})
                  </p>
                )}
              </div>
            )}

            {/* Transferencia → datos del comprobante (sin billetes) */}
            {gVia === "transferencia" && (
              <div className="space-y-2 rounded-lg border border-brand-border bg-primary-light/20 p-3">
                <p className="text-[11px] font-semibold text-brand-dark">
                  Datos de la transferencia
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark/55">
                      Nº de transferencia
                    </label>
                    <input
                      value={gTransferNum}
                      onChange={(e) => setGTransferNum(e.target.value)}
                      placeholder="Comprobante"
                      className="w-full rounded-lg border border-brand-border bg-white px-2 py-1.5 text-xs outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark/55">
                      Banco emisor
                    </label>
                    <input
                      value={gTransferBanco}
                      onChange={(e) => setGTransferBanco(e.target.value)}
                      placeholder="Banco"
                      className="w-full rounded-lg border border-brand-border bg-white px-2 py-1.5 text-xs outline-none focus:border-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark/55">
                    Titular de la cuenta que transfiere
                  </label>
                  <input
                    value={gTransferTitular}
                    onChange={(e) => setGTransferTitular(e.target.value)}
                    placeholder="Nombre del titular (puede ser un cliente)"
                    className="w-full rounded-lg border border-brand-border bg-white px-2 py-1.5 text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>
            )}
          </div>

          {gMsg && (
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {gMsg}
            </p>
          )}
          <button
            type="submit"
            className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"
          >
            Registrar pago
          </button>
        </form>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {error}
          </p>
        )}
      </div>

      {/* === Registro === */}
      <div>
        <h2 className="mb-3 font-serif text-xl text-brand-dark">
          Cuentas corrientes
        </h2>
        <CuentaCorrienteView
          proveedores={proveedores}
          purchases={purchases}
          payments={payments}
          onDeletePurchase={handleDeletePurchase}
          onDeletePayment={handleDeletePayment}
          onEditPayment={setEditPago}
          onDeleteProveedor={handleDeleteProveedor}
        />
      </div>

      {editPago && (
        <EditarPagoModal
          pago={editPago}
          compras={purchases.filter((p) => p.proveedorId === editPago.proveedorId)}
          onCancel={() => setEditPago(null)}
          onSave={async (patch) => {
            try {
              await updatePayment(editPago.id, patch);
              setEditPago(null);
            } catch {
              alert("No se pudo actualizar el pago.");
            }
          }}
        />
      )}

      {gShowArqueo && (
        <ArqueoDepositoModal
          montoObjetivo={Number(gMonto) || 0}
          inicial={gArqueo}
          onCancel={() => setGShowArqueo(false)}
          onConfirm={(arqueo) => {
            setGArqueo(arqueo);
            setGShowArqueo(false);
          }}
        />
      )}
    </div>
  );
}

// ====== Modal: editar un pago a proveedor ======
function EditarPagoModal({
  pago,
  compras,
  onCancel,
  onSave,
}: {
  pago: SupplierPayment;
  compras: Purchase[];
  onCancel: () => void;
  onSave: (patch: {
    monto: number;
    fecha: number;
    modalidad: PurchaseModalidad;
    via: PagoVia;
    purchaseId: string | null;
  }) => void | Promise<void>;
}) {
  const isoDe = (ts: number) => {
    const d = new Date(ts);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const [monto, setMonto] = useState(pago.monto);
  const [fecha, setFecha] = useState(isoDe(pago.fecha));
  const [modalidad, setModalidad] = useState<PurchaseModalidad>(
    pago.modalidad ?? "A"
  );
  const [via, setVia] = useState<PagoViaSel>(
    (["deposito", "transferencia", "agencia", "efectivo"] as const).includes(
      pago.via as PagoViaSel
    )
      ? (pago.via as PagoViaSel)
      : "transferencia"
  );
  const [purchaseId, setPurchaseId] = useState(pago.purchaseId ?? "");
  const [busy, setBusy] = useState(false);

  const inputCls =
    "w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary";
  const labelCls =
    "mb-1 block text-[11px] font-bold uppercase tracking-wider text-brand-dark/55";

  const guardar = async () => {
    if (monto <= 0) return;
    setBusy(true);
    await onSave({
      monto: Number(monto),
      fecha: tsFromISO(fecha),
      modalidad,
      via,
      purchaseId: purchaseId || null,
    });
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-brand-border p-5">
          <h2 className="font-serif text-xl text-brand-dark">Editar pago</h2>
        </div>
        <div className="space-y-3 p-5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Monto</label>
              <input
                type="number"
                min={1}
                step="any"
                value={monto || ""}
                onChange={(e) => setMonto(Number(e.target.value))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Imputar a</label>
            <select
              value={purchaseId}
              onChange={(e) => setPurchaseId(e.target.value)}
              className={inputCls}
            >
              <option value="">Pago a cuenta (general)</option>
              {compras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.modalidad} · {c.numero}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Modalidad</label>
              <select
                value={modalidad}
                onChange={(e) =>
                  setModalidad(e.target.value as PurchaseModalidad)
                }
                className={inputCls}
              >
                <option value="A">A (facturado)</option>
                <option value="B">B (sin facturar)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Vía de pago</label>
              <select
                value={via}
                onChange={(e) => setVia(e.target.value as PagoViaSel)}
                className={inputCls}
              >
                {(Object.keys(VIA_LABELS) as PagoViaSel[]).map((v) => (
                  <option key={v} value={v}>
                    {VIA_LABELS[v]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[10px] text-brand-dark/45">
            Para cambiar billetes/datos de transferencia, borrá el pago y
            registralo de nuevo.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="rounded-lg border border-brand-border px-4 py-2 text-sm font-medium hover:bg-primary-light"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={busy || monto <= 0}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {busy ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ====== Modal: detalle de billetes de un depósito bancario ======
function ArqueoDepositoModal({
  montoObjetivo,
  inicial,
  onCancel,
  onConfirm,
}: {
  montoObjetivo: number;
  inicial: Record<string, number>;
  onCancel: () => void;
  onConfirm: (arqueo: Record<string, number>) => void;
}) {
  const [arqueo, setArqueo] = useState<Record<string, number>>(inicial);
  const total = totalArqueo(arqueo);
  const diff = montoObjetivo - total;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-brand-border p-5">
          <h2 className="font-serif text-xl text-brand-dark">
            Billetes del depósito
          </h2>
          <p className="mt-1 text-sm text-brand-dark/65">
            Cargá cuántos billetes de cada denominación depositás. Es opcional;
            si lo completás, el total debería coincidir con el monto del pago.
          </p>
        </div>
        <div className="p-5">
          <div className="space-y-1">
            {DENOMINACIONES.map((d) => (
              <div key={d} className="flex items-center justify-between gap-3">
                <span className="w-24 text-sm text-brand-dark/70">
                  {formatARS(d)}
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={arqueo[d] || ""}
                  placeholder="0"
                  onChange={(e) =>
                    setArqueo((a) => ({ ...a, [d]: Number(e.target.value) }))
                  }
                  className="w-24 rounded border border-brand-border bg-white px-2 py-1 text-right text-sm outline-none focus:border-primary"
                />
                <span className="flex-1 text-right text-xs text-brand-dark/55">
                  {formatARS(d * (arqueo[d] || 0))}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-1 rounded-lg bg-slate-50 p-3 text-xs">
            <Linea label="Total contado" value={formatARS(total)} />
            <Linea label="Monto del pago" value={formatARS(montoObjetivo)} />
            {montoObjetivo > 0 && total > 0 && (
              <Linea
                label="Diferencia"
                value={diff === 0 ? "✓ coincide" : formatARS(diff)}
                tone={diff === 0 ? "emerald" : "rose"}
              />
            )}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="rounded-lg border border-brand-border px-4 py-2 text-sm font-medium hover:bg-primary-light"
            >
              Cancelar
            </button>
            <button
              onClick={() => onConfirm(arqueo)}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              Guardar billetes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function Linea({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "rose";
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "rose"
      ? "text-rose-700"
      : "text-brand-dark";
  return (
    <div className="flex items-center justify-between">
      <span className="text-brand-dark/60">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  );
}
