"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useProducts } from "@/hooks/useProducts";
import { getAllOrders } from "@/lib/orders";
import { getAllUsers } from "@/lib/admin";
import { subscribeChecks, chequesProximos, chequesVencidos } from "@/lib/cashflow";
import { formatARS, daysBetween } from "@/lib/format";
import type { AppUser, Check, Order } from "@/lib/types";

type KPI = {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  accent?: string;
};

const Card = ({ k }: { k: KPI }) => {
  const inner = (
    <div className="flex h-full flex-col rounded-2xl border border-brand-border bg-surface p-5 shadow-sm transition hover:shadow-md">
      <span className="text-xs uppercase tracking-wider text-brand-dark/55">
        {k.label}
      </span>
      <span
        className={`mt-2 font-serif text-3xl font-light ${k.accent ?? "text-primary"}`}
      >
        {k.value}
      </span>
      {k.hint && (
        <span className="mt-2 text-xs text-brand-dark/60">{k.hint}</span>
      )}
    </div>
  );
  return k.href ? <Link href={k.href}>{inner}</Link> : inner;
};

export default function AdminDashboard() {
  const productos = useProducts();
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAllOrders(200), getAllUsers()])
      .then(([o, u]) => {
        setOrders(o);
        setUsers(u);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
    const unsub = subscribeChecks(setChecks);
    return unsub;
  }, []);

  const proximos = chequesProximos(checks, 3);
  const vencidos = chequesVencidos(checks);

  if (loading) {
    return <p className="py-8 text-center text-brand-dark/60">Cargando…</p>;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTs = today.getTime();
  const pedidosHoy = orders.filter((o) => o.createdAt >= todayTs);
  const pedidosNuevos = orders.filter((o) => o.status === "nuevo");
  const totalProductos = productos.filter((p) => p.activo).length;
  const totalUsuarios = users.length;
  const vendedores = users.filter((u) => u.role === "vendedor").length;
  const totalFacturado = orders
    .filter((o) => o.status !== "cancelado")
    .reduce((s, o) => s + (o.total || 0), 0);

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
              <ul className="mt-1 space-y-0.5 text-xs text-amber-800">
                {proximos.slice(0, 3).map((c) => (
                  <li key={c.id}>
                    • #{c.numero} {c.beneficiario} ·{" "}
                    {formatARS(c.monto)} en{" "}
                    {daysBetween(Date.now(), c.fechaPago)} d
                  </li>
                ))}
              </ul>
            </a>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          k={{
            label: "Pedidos del día",
            value: pedidosHoy.length,
            hint: "Ingresados hoy",
            href: "/admin/pedidos",
            accent: "text-primary",
          }}
        />
        <Card
          k={{
            label: "Pedidos nuevos",
            value: pedidosNuevos.length,
            hint: "Pendientes de procesar",
            href: "/admin/pedidos",
            accent: "text-accent",
          }}
        />
        <Card
          k={{
            label: "Productos activos",
            value: totalProductos,
            hint: "82 en el catálogo",
            href: "/admin/productos",
          }}
        />
        <Card
          k={{
            label: "Usuarios",
            value: totalUsuarios,
            hint: `${vendedores} vendedor${vendedores === 1 ? "" : "es"}`,
            href: "/admin/usuarios",
          }}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card
          k={{
            label: "Pedidos totales",
            value: orders.length,
            hint: "Histórico acumulado",
          }}
        />
        <Card
          k={{
            label: "Total facturado (no cancelados)",
            value: totalFacturado > 0 ? formatARS(totalFacturado) : "a confirmar",
            hint:
              totalFacturado === 0
                ? "Los precios se cargan desde Productos"
                : "Suma de pedidos válidos",
            accent: "text-emerald-700",
          }}
        />
      </div>

      <section className="mt-8 rounded-2xl border border-brand-border bg-surface p-5">
        <h2 className="font-serif text-xl text-brand-dark">
          Atajos rápidos
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Link
            href="/admin/pedidos"
            className="rounded-lg bg-primary px-4 py-3 text-center text-sm font-semibold text-white hover:bg-primary-dark"
          >
            Ver bandeja de pedidos
          </Link>
          <Link
            href="/admin/productos"
            className="rounded-lg border border-brand-border bg-surface px-4 py-3 text-center text-sm font-semibold text-primary hover:bg-primary-light"
          >
            Editar precios / destacados
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
