"use client";

import { useState } from "react";
import { formatARS, formatDate } from "@/lib/format";
import { saldoProveedor, saldoCompra, deudaGlobal } from "@/lib/cuentas";
import {
  MODALIDAD_LABELS,
  type Proveedor,
  type Purchase,
  type SupplierPayment,
} from "@/lib/types";

interface Props {
  proveedores: Proveedor[];
  purchases: Purchase[];
  payments: SupplierPayment[];
  readOnly?: boolean;
  onDeletePurchase?: (id: string) => void;
  onDeletePayment?: (id: string) => void;
}

export default function CuentaCorrienteView({
  proveedores,
  purchases,
  payments,
  readOnly = false,
  onDeletePurchase,
  onDeletePayment,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const total = deudaGlobal(purchases, payments);

  return (
    <div>
      {/* Deuda global */}
      <div className="mb-4 flex items-center justify-between rounded-2xl border-2 border-rose-200 bg-rose-50 px-4 py-3">
        <span className="font-serif text-lg text-rose-900">
          Deuda total a proveedores
        </span>
        <span className="font-serif text-2xl font-bold text-rose-900">
          {total > 0 ? formatARS(total) : "—"}
        </span>
      </div>

      {proveedores.length === 0 ? (
        <p className="rounded-xl border border-brand-border bg-surface p-6 text-center text-brand-dark/55">
          Todavía no hay proveedores.
        </p>
      ) : (
        <div className="space-y-2">
          {proveedores.map((prov) => {
            const { comprado, pagado, deuda } = saldoProveedor(
              prov.id,
              purchases,
              payments
            );
            const open = openId === prov.id;
            const compras = purchases.filter((p) => p.proveedorId === prov.id);
            const pagos = payments.filter((p) => p.proveedorId === prov.id);

            return (
              <article
                key={prov.id}
                className="overflow-hidden rounded-xl border border-brand-border bg-surface"
              >
                <button
                  onClick={() => setOpenId(open ? null : prov.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-primary-light/30"
                >
                  <div>
                    <p className="font-semibold text-brand-dark">
                      {prov.nombre}
                    </p>
                    {prov.cuit && (
                      <p className="text-[11px] text-brand-dark/55">
                        CUIT {prov.cuit}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="text-[10px] uppercase text-brand-dark/45">
                        Deuda
                      </p>
                      <p
                        className={`font-bold ${
                          deuda > 0 ? "text-rose-700" : "text-emerald-700"
                        }`}
                      >
                        {deuda > 0 ? formatARS(deuda) : "Al día"}
                      </p>
                    </div>
                    <span className="text-brand-dark/40">{open ? "▲" : "▼"}</span>
                  </div>
                </button>

                {open && (
                  <div className="border-t border-brand-border bg-slate-50/60 p-4">
                    {/* Resumen */}
                    <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <Mini label="Comprado" value={comprado} tone="dark" />
                      <Mini label="Pagado" value={pagado} tone="emerald" />
                      <Mini label="Deuda" value={deuda} tone="rose" />
                    </div>

                    {/* Compras */}
                    <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-dark/55">
                      Compras
                    </h4>
                    {compras.length === 0 ? (
                      <p className="mb-3 text-xs text-brand-dark/45">
                        Sin compras registradas.
                      </p>
                    ) : (
                      <div className="mb-3 overflow-x-auto rounded-lg border border-brand-border bg-surface">
                        <table className="w-full text-xs">
                          <thead className="bg-primary-light/40 text-[10px] uppercase text-primary">
                            <tr>
                              <th className="px-2 py-1.5 text-left">Modalidad</th>
                              <th className="px-2 py-1.5 text-left">Nº</th>
                              <th className="px-2 py-1.5 text-left">Fecha</th>
                              <th className="px-2 py-1.5 text-left">Camión</th>
                              <th className="px-2 py-1.5 text-right">Monto</th>
                              <th className="px-2 py-1.5 text-right">Saldo</th>
                              {!readOnly && <th className="w-8" />}
                            </tr>
                          </thead>
                          <tbody>
                            {compras.map((c) => {
                              const saldo = saldoCompra(c, payments);
                              return (
                                <tr
                                  key={c.id}
                                  className="border-t border-brand-border first:border-t-0"
                                >
                                  <td className="px-2 py-1.5">
                                    {MODALIDAD_LABELS[c.modalidad]}
                                  </td>
                                  <td className="px-2 py-1.5">{c.numero}</td>
                                  <td className="px-2 py-1.5">
                                    {formatDate(c.fecha)}
                                  </td>
                                  <td className="px-2 py-1.5 text-brand-dark/60">
                                    {c.camionNombre ?? "—"}
                                  </td>
                                  <td className="px-2 py-1.5 text-right font-semibold">
                                    {formatARS(c.monto)}
                                  </td>
                                  <td
                                    className={`px-2 py-1.5 text-right ${
                                      saldo > 0
                                        ? "font-semibold text-rose-700"
                                        : "text-emerald-700"
                                    }`}
                                  >
                                    {saldo > 0 ? formatARS(saldo) : "✓"}
                                  </td>
                                  {!readOnly && (
                                    <td className="px-2 py-1.5 text-center">
                                      <button
                                        onClick={() => onDeletePurchase?.(c.id)}
                                        className="text-rose-600 hover:opacity-70"
                                        title="Eliminar compra"
                                      >
                                        ✕
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Pagos */}
                    <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-dark/55">
                      Pagos
                    </h4>
                    {pagos.length === 0 ? (
                      <p className="text-xs text-brand-dark/45">
                        Sin pagos registrados.
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-brand-border bg-surface">
                        <table className="w-full text-xs">
                          <thead className="bg-emerald-50 text-[10px] uppercase text-emerald-800">
                            <tr>
                              <th className="px-2 py-1.5 text-left">Fecha</th>
                              <th className="px-2 py-1.5 text-left">Imputado a</th>
                              <th className="px-2 py-1.5 text-left">Forma</th>
                              <th className="px-2 py-1.5 text-right">Monto</th>
                              {!readOnly && <th className="w-8" />}
                            </tr>
                          </thead>
                          <tbody>
                            {pagos.map((pg) => {
                              const compra = pg.purchaseId
                                ? compras.find((c) => c.id === pg.purchaseId)
                                : null;
                              return (
                                <tr
                                  key={pg.id}
                                  className="border-t border-brand-border first:border-t-0"
                                >
                                  <td className="px-2 py-1.5">
                                    {formatDate(pg.fecha)}
                                  </td>
                                  <td className="px-2 py-1.5 text-brand-dark/60">
                                    {compra
                                      ? `${MODALIDAD_LABELS[compra.modalidad]} ${compra.numero}`
                                      : "A cuenta"}
                                  </td>
                                  <td className="px-2 py-1.5 text-brand-dark/60">
                                    {pg.formaPago ?? "—"}
                                  </td>
                                  <td className="px-2 py-1.5 text-right font-semibold text-emerald-700">
                                    {formatARS(pg.monto)}
                                  </td>
                                  {!readOnly && (
                                    <td className="px-2 py-1.5 text-center">
                                      <button
                                        onClick={() => onDeletePayment?.(pg.id)}
                                        className="text-rose-600 hover:opacity-70"
                                        title="Eliminar pago"
                                      >
                                        ✕
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "dark" | "emerald" | "rose";
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "rose"
      ? "text-rose-700"
      : "text-brand-dark";
  return (
    <div className="rounded-lg border border-brand-border bg-surface py-2">
      <p className="text-[10px] uppercase text-brand-dark/45">{label}</p>
      <p className={`font-bold ${color}`}>
        {value === 0 ? "—" : formatARS(value)}
      </p>
    </div>
  );
}
