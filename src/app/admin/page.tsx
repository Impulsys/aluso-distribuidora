"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useProducts } from "@/hooks/useProducts";
import { getAllOrders } from "@/lib/orders";
import { getAllUsers, subscribeProductCosts } from "@/lib/admin";
import { subscribeChecks, chequesProximos, chequesVencidos } from "@/lib/cashflow";
import { subscribeRemitos } from "@/lib/ventas";
import {
  subscribePurchases,
  subscribeSupplierPayments,
  deudaGlobal,
} from "@/lib/cuentas";
import { formatARS, daysBetween } from "@/lib/format";
import type {
  AppUser,
  Check,
  Order,
  Purchase,
  Remito,
  SupplierPayment,
} from "@/lib/types";

type KPI = {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  accent?: string;
};

const Card = ({ k }: { k: KPI }) => {
  const inner = (
    <div className="flex h-full flex-col rounded-2xl border border-brand-border bg-surface p-4 shadow-sm transition hover:shadow-md">
      <span className="text-[11px] uppercase tracking-wider text-brand-dark/55">
        {k.label}
      </span>
      <span
        className={`mt-1 font-serif text-2xl font-medium ${k.accent ?? "text-primary"}`}
      >
        {k.value}
      </span>
      {k.hint && (
        <span className="mt-auto pt-2 text-[11px] text-brand-dark/55">
          {k.hint}
        </span>
      )}
    </div>
  );
  return k.href ? (
    <Link href={k.href} className="h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
};

export default function AdminDashboard() {
  const productos = useProducts();
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [checks, setChecks] = useState<Check[]>([]);
  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [pagos, setPagos] = useState<SupplierPayment[]>([]);
  const [costs, setCosts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAllOrders(200), getAllUsers()])
      .then(([o, u]) => {
        setOrders(o);
        setUsers(u);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
    const unsubs = [
      subscribeChecks(setChecks),
      subscribeRemitos(setRemitos),
      subscribePurchases(setPurchases),
      subscribeSupplierPayments(setPagos),
      subscribeProductCosts(setCosts),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const proximos = chequesProximos(checks, 3);
  const vencidos = chequesVencidos(checks);

  const { ventaHoy, gananciaHoy } = useMemo(() => {
    const start = new Date().setHours(0, 0, 0, 0);
    const end = start + 86_400_000;
    const hoy = remitos.filter(
      (r) => r.fecha >= start && r.fecha < end && !r.anulado
    );
    const venta = hoy.reduce((s, r) => s + r.total, 0);
    const ganancia = hoy.reduce(
      (s, r) =>
        s +
        r.items.reduce(
          (a, it) => a + (it.precioVenta - it.costoUnitario) * it.cantidad,
          0
        ),
      0
    );
    return { ventaHoy: venta, gananciaHoy: ganancia };
  }, [remitos]);

  if (loading) {
    return <p className="py-8 text-center text-brand-dark/60">Cargando…</p>;
  }

  const deuda = deudaGlobal(purchases, pagos);
  const patrimonio = productos.reduce(
    (s, p) => s + (p.stock || 0) * (costs[p.id] ?? 0),
    0
  );
  const pedidosNuevos = orders.filter((o) => o.status === "nuevo").length;
  const totalProductos = productos.filter((p) => p.activo).length;
  const vendedores = users.filter((u) => u.role === "vendedor").length;

  return (
    <div>
      {/* Alertas de cheques */}
      {(vencidos.length > 0 || proximos.length > 0) && (
        <div className="mb-4 space-y-2">
          {vencidos.length > 0 && (
            <a
              href="/admin/cheques"
              className="block rounded-2xl border border-rose-300 bg-rose-50 p-4 transition hover:bg-rose-100"
            >
              <p className="text-sm font-bold text-rose-900">
                🚨 {vencidos.length} cheque{vencidos.length === 1 ? "" : "s"}{" "}
                vencido{vencidos.length === 1 ? "" : "s"} sin pagar
              </p>
              <p className="mt-1 text-xs text-rose-800">
                Tocá para revisar la sección de cheques →
              </p>
            </a>
          )}
          {proximos.length > 0 && (
            <a
              href="/admin/cheques"
              className="block rounded-2xl border border-amber-300 bg-amber-50 p-4 transition hover:bg-amber-100"
            >
              <p className="text-sm font-bold text-amber-900">
                ⚠️ {proximos.length} cheque{proximos.length === 1 ? "" : "s"}{" "}
                vence{proximos.length === 1 ? "" : "n"} en los próximos 3 días
              </p>
            </a>
          )}
        </div>
      )}

      {/* Métricas del negocio (reales) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card
          k={{
            label: "Venta del día",
            value: ventaHoy > 0 ? formatARS(ventaHoy) : "—",
            hint: "Ver Caja",
            href: "/admin/pedidos",
            accent: "text-sky-700",
          }}
        />
        <Card
          k={{
            label: "Ganancia del día",
            value: gananciaHoy > 0 ? formatARS(gananciaHoy) : "—",
            hint: "Venta − costo de hoy",
            accent: "text-emerald-700",
          }}
        />
        <Card
          k={{
            label: "Deuda a proveedores",
            value: deuda > 0 ? formatARS(deuda) : "Al día",
            hint: "Cuentas corrientes",
            href: "/admin/cuentas",
            accent: "text-rose-700",
          }}
        />
        <Card
          k={{
            label: "Patrimonio en stock",
            value: patrimonio > 0 ? formatARS(patrimonio) : "—",
            hint: "Stock × costo",
            accent: "text-emerald-700",
          }}
        />
      </div>

      {/* Operación */}
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card
          k={{
            label: "Pedidos pendientes",
            value: pedidosNuevos,
            hint: "Web/vendedor sin procesar",
            href: "/admin/pedidos",
            accent: "text-accent",
          }}
        />
        <Card
          k={{
            label: "Productos activos",
            value: totalProductos,
            hint: "En el catálogo",
            href: "/admin/productos",
          }}
        />
        <Card
          k={{
            label: "Usuarios",
            value: users.length,
            hint: `${vendedores} vendedor${vendedores === 1 ? "" : "es"}`,
            href: "/admin/usuarios",
          }}
        />
      </div>

      <section className="mt-8 rounded-2xl border border-brand-border bg-surface p-5">
        <h2 className="font-serif text-xl text-brand-dark">Atajos rápidos</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Link
            href="/admin/pedidos"
            className="rounded-lg bg-primary px-4 py-3 text-center text-sm font-semibold text-white hover:bg-primary-dark"
          >
            Nueva venta / Caja
          </Link>
          <Link
            href="/admin/productos"
            className="rounded-lg border border-brand-border bg-surface px-4 py-3 text-center text-sm font-semibold text-primary hover:bg-primary-light"
          >
            Editar precios / stock
          </Link>
          <Link
            href="/admin/usuarios"
            className="rounded-lg border border-brand-border bg-surface px-4 py-3 text-center text-sm font-semibold text-primary hover:bg-primary-light"
          >
            Asignar roles
          </Link>
        </div>
      </section>
    </div>
  );
}
