"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import CuentaCorrienteView from "@/components/CuentaCorrienteView";
import {
  subscribeProveedores,
  subscribePurchases,
  subscribeSupplierPayments,
  seedProveedoresIfEmpty,
  createProveedor,
  createPurchase,
  createPayment,
  deletePurchase,
  deletePayment,
} from "@/lib/cuentas";
import type {
  FormaPago,
  Proveedor,
  Purchase,
  PurchaseModalidad,
  SupplierPayment,
} from "@/lib/types";

function todayISO() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t.toISOString().slice(0, 10);
}

const FORMAS: FormaPago[] = ["efectivo", "cheque", "transferencia"];

export default function AdminCuentasPage() {
  const { user } = useAuth();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);

  // Form: nuevo proveedor
  const [pNombre, setPNombre] = useState("");
  const [pCuit, setPCuit] = useState("");
  const [pContacto, setPContacto] = useState("");

  // Form: nueva compra
  const [cProv, setCProv] = useState("");
  const [cModalidad, setCModalidad] = useState<PurchaseModalidad>("A");
  const [cNumero, setCNumero] = useState("");
  const [cMonto, setCMonto] = useState(0);
  const [cFecha, setCFecha] = useState(todayISO());

  // Form: nuevo pago
  const [gProv, setGProv] = useState("");
  const [gMonto, setGMonto] = useState(0);
  const [gFecha, setGFecha] = useState(todayISO());
  const [gForma, setGForma] = useState<FormaPago>("efectivo");
  const [gPurchase, setGPurchase] = useState(""); // "" = a cuenta

  const [error, setError] = useState<string | null>(null);

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

  const handleAddCompra = async (e: React.FormEvent) => {
    e.preventDefault();
    const prov = proveedores.find((p) => p.id === cProv);
    if (!prov || !cNumero.trim() || cMonto <= 0) return;
    setError(null);
    try {
      await createPurchase({
        proveedorId: prov.id,
        proveedorNombre: prov.nombre,
        modalidad: cModalidad,
        numero: cNumero.trim(),
        monto: Number(cMonto),
        fecha: new Date(cFecha).getTime(),
        createdBy: user?.uid,
      });
      setCNumero("");
      setCMonto(0);
    } catch (err) {
      console.error(err);
      setError("No se pudo registrar la compra.");
    }
  };

  const handleAddPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gProv || gMonto <= 0) return;
    setError(null);
    try {
      await createPayment({
        proveedorId: gProv,
        monto: Number(gMonto),
        fecha: new Date(gFecha).getTime(),
        formaPago: gForma,
        purchaseId: gPurchase || undefined,
        createdBy: user?.uid,
      });
      setGMonto(0);
      setGPurchase("");
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

        {/* Nueva compra */}
        <form
          onSubmit={handleAddCompra}
          className="rounded-2xl border border-brand-border bg-surface p-4"
        >
          <h2 className="mb-3 font-serif text-lg text-brand-dark">
            Registrar compra (deuda)
          </h2>
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
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Modalidad</label>
                <select
                  value={cModalidad}
                  onChange={(e) =>
                    setCModalidad(e.target.value as PurchaseModalidad)
                  }
                  className={inputCls}
                >
                  <option value="A">A (facturado)</option>
                  <option value="B">B (sin facturar)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Nº factura / remito</label>
                <input
                  required
                  value={cNumero}
                  onChange={(e) => setCNumero(e.target.value)}
                  placeholder="0001-..."
                  className={inputCls}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Monto</label>
                <input
                  required
                  type="number"
                  min={1}
                  step={1000}
                  value={cMonto || ""}
                  onChange={(e) => setCMonto(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Fecha</label>
                <input
                  type="date"
                  value={cFecha}
                  onChange={(e) => setCFecha(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          </div>
          <button
            type="submit"
            className="mt-3 w-full rounded-lg bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-dark"
          >
            Registrar compra
          </button>
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
                {comprasDelProv.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.modalidad} · {c.numero} ({c.camionNombre ?? "s/camión"})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Monto</label>
                <input
                  required
                  type="number"
                  min={1}
                  step={1000}
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
            <div>
              <label className={labelCls}>Forma de pago</label>
              <select
                value={gForma}
                onChange={(e) => setGForma(e.target.value as FormaPago)}
                className={inputCls}
              >
                {FORMAS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>
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
        />
      </div>
    </div>
  );
}
