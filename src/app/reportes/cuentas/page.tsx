"use client";

import { useEffect, useState } from "react";
import CuentaCorrienteView from "@/components/CuentaCorrienteView";
import {
  subscribeProveedores,
  subscribePurchases,
  subscribeSupplierPayments,
} from "@/lib/cuentas";
import type { Proveedor, Purchase, SupplierPayment } from "@/lib/types";

export default function ReportesCuentasPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);

  useEffect(() => {
    const u1 = subscribeProveedores(setProveedores);
    const u2 = subscribePurchases(setPurchases);
    const u3 = subscribeSupplierPayments(setPayments);
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  return (
    <div>
      <p className="mb-4 text-sm text-brand-dark/65">
        Compras y pagos por proveedor. Tocá un proveedor para ver el detalle.
      </p>
      <CuentaCorrienteView
        proveedores={proveedores}
        purchases={purchases}
        payments={payments}
        readOnly
      />
    </div>
  );
}
