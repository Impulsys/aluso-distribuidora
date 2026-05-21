"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getOrdersByVendedor } from "@/lib/orders";
import type { Order, OrderStatus } from "@/lib/types";
import { formatARS, formatDate } from "@/lib/format";

const STATUS_STYLES: Record<OrderStatus, string> = {
  nuevo: "bg-sky-100 text-sky-800",
  en_proceso: "bg-amber-100 text-amber-800",
  entregado: "bg-emerald-100 text-emerald-800",
  cancelado: "bg-rose-100 text-rose-800",
};
const STATUS_LABEL: Record<OrderStatus, string> = {
  nuevo: "Nuevo",
  en_proceso: "En proceso",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export default function MisPedidosPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getOrdersByVendedor(user.uid)
      .then((o) => {
        setOrders(o);
        setError(null);
      })
      .catch((e) => {
        console.error(e);
        setError("No se pudieron cargar los pedidos.");
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <p className="py-8 text-center text-brand-dark/60">Cargando pedidos…</p>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
        {error}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-brand-border bg-surface p-10 text-center">
        <p className="font-serif text-xl text-brand-dark">
          Todavía no registraste pedidos
        </p>
        <p className="mt-2 text-sm text-brand-dark/60">
          Armá el carrito con productos y registrá tu primer pedido.
        </p>
        <Link
          href="/vendedor"
          className="mt-6 inline-block rounded-full bg-primary px-5 py-2.5 font-medium text-white"
        >
          Empezar nuevo pedido
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="mb-2 text-sm text-brand-dark/60">
        {orders.length} pedido{orders.length === 1 ? "" : "s"}
      </p>
      {orders.map((o) => (
        <article
          key={o.id}
          className="rounded-xl border border-brand-border bg-surface p-4 transition hover:shadow-md"
        >
          <header className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-brand-dark/50">
                #{o.id.slice(0, 6)}
              </span>
              <span className="text-xs text-brand-dark/60">
                {formatDate(o.createdAt)}
              </span>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLES[o.status]}`}
            >
              {STATUS_LABEL[o.status]}
            </span>
          </header>
          <p className="mt-2 font-semibold text-brand-dark">
            {o.clienteNombre || "(sin cliente)"}
            {o.clienteTelefono && (
              <span className="ml-2 text-sm font-normal text-brand-dark/60">
                · {o.clienteTelefono}
              </span>
            )}
          </p>
          <p className="mt-1 text-sm text-brand-dark/60">
            {o.items.length} ítem{o.items.length === 1 ? "" : "s"}
            {o.total > 0 && <> · {formatARS(o.total)}</>}
            {o.total === 0 && <> · total a confirmar</>}
          </p>
          {o.notas && (
            <p className="mt-2 text-xs italic text-brand-dark/55">
              📝 {o.notas}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
