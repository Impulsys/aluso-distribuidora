"use client";

import { useEffect, useMemo, useState } from "react";
import { getAllOrders } from "@/lib/orders";
import { updateOrderStatus } from "@/lib/admin";
import { formatARS, formatDate } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";

const STATUS_OPTIONS: OrderStatus[] = [
  "nuevo",
  "en_proceso",
  "entregado",
  "cancelado",
];

const STATUS_STYLES: Record<OrderStatus, string> = {
  nuevo: "bg-sky-100 text-sky-800 ring-sky-300",
  en_proceso: "bg-amber-100 text-amber-800 ring-amber-300",
  entregado: "bg-emerald-100 text-emerald-800 ring-emerald-300",
  cancelado: "bg-rose-100 text-rose-800 ring-rose-300",
};
const STATUS_LABEL: Record<OrderStatus, string> = {
  nuevo: "Nuevo",
  en_proceso: "En proceso",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

const FILTERS: { id: "todos" | OrderStatus; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "nuevo", label: "Nuevos" },
  { id: "en_proceso", label: "En proceso" },
  { id: "entregado", label: "Entregados" },
  { id: "cancelado", label: "Cancelados" },
];

export default function AdminPedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<"todos" | OrderStatus>("todos");
  const [origen, setOrigen] = useState<"todos" | "web" | "vendedor">("todos");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const o = await getAllOrders(200);
      setOrders(o);
      setError(null);
    } catch (e) {
      console.error(e);
      setError("No se pudieron cargar los pedidos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: orders.length };
    STATUS_OPTIONS.forEach((s) => {
      c[s] = orders.filter((o) => o.status === s).length;
    });
    return c;
  }, [orders]);

  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    return orders
      .filter((o) => (filter === "todos" ? true : o.status === filter))
      .filter((o) => (origen === "todos" ? true : o.origin === origen))
      .filter((o) => {
        if (!t) return true;
        return (
          o.id.toLowerCase().includes(t) ||
          (o.clienteNombre ?? "").toLowerCase().includes(t) ||
          (o.clienteTelefono ?? "").toLowerCase().includes(t) ||
          (o.createdByName ?? "").toLowerCase().includes(t) ||
          o.items.some((i) => i.nombre.toLowerCase().includes(t))
        );
      });
  }, [orders, filter, origen, q]);

  const handleStatus = async (id: string, status: OrderStatus) => {
    setBusy(id);
    try {
      await updateOrderStatus(id, status);
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status } : o))
      );
    } catch (e) {
      console.error(e);
      alert("No se pudo actualizar el pedido.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      {/* Buscador */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-dark/40">
            🔎
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por cliente, teléfono, vendedor, producto o nº pedido…"
            className="w-full rounded-full border border-brand-border bg-surface py-2 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-dark/40 hover:text-brand-dark"
              aria-label="Limpiar"
            >
              ✕
            </button>
          )}
        </div>
        <div className="inline-flex overflow-hidden rounded-full border border-brand-border bg-surface text-xs">
          {(
            [
              { id: "todos", label: "Todos" },
              { id: "vendedor", label: "👤 Vendedor" },
              { id: "web", label: "🌐 Web" },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              onClick={() => setOrigen(o.id)}
              className={`px-3 py-1.5 font-medium transition ${
                origen === o.id
                  ? "bg-primary text-white"
                  : "text-brand-dark/70 hover:bg-primary-light"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button
          onClick={refresh}
          className="rounded-full border border-brand-border bg-surface px-4 py-1.5 text-xs font-medium hover:bg-primary-light"
        >
          🔄 Refrescar
        </button>
      </div>

      {/* Filtros por estado */}
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
              filter === f.id
                ? "bg-primary text-white shadow-sm"
                : "border border-brand-border bg-surface text-brand-dark hover:border-primary"
            }`}
          >
            {f.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                filter === f.id
                  ? "bg-white/20 text-white"
                  : "bg-primary-light text-primary"
              }`}
            >
              {counts[f.id] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {loading && (
        <p className="py-8 text-center text-brand-dark/60">Cargando…</p>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
          {error}
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="rounded-2xl border border-brand-border bg-surface p-10 text-center">
          <p className="font-serif text-xl text-brand-dark">
            No hay pedidos {filter === "todos" ? "registrados" : `en estado "${STATUS_LABEL[filter as OrderStatus]}"`}.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {visible.map((o) => (
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
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    o.origin === "vendedor"
                      ? "bg-violet-100 text-violet-800"
                      : "bg-cyan-100 text-cyan-800"
                  }`}
                >
                  {o.origin === "vendedor" ? "👤 Vendedor" : "🌐 Web"}
                </span>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${STATUS_STYLES[o.status]}`}
              >
                {STATUS_LABEL[o.status]}
              </span>
            </header>

            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start">
              <div>
                <p className="font-semibold text-brand-dark">
                  {o.clienteNombre || "(sin nombre de cliente)"}
                  {o.clienteTelefono && (
                    <span className="ml-2 text-sm font-normal text-brand-dark/60">
                      · {o.clienteTelefono}
                    </span>
                  )}
                </p>
                <p className="text-sm text-brand-dark/60">
                  Por: <b>{o.createdByName}</b>
                </p>
                <ul className="mt-2 space-y-0.5 text-sm">
                  {o.items.map((it) => (
                    <li key={it.productId} className="text-brand-dark/80">
                      • {it.cantidad}× {it.nombre}
                      {it.precioVenta > 0 && (
                        <span className="text-brand-dark/55">
                          {" "}
                          — {formatARS(it.precioVenta * it.cantidad)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {o.notas && (
                  <p className="mt-2 text-xs italic text-brand-dark/55">
                    📝 {o.notas}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="font-bold text-primary">
                  {o.total > 0 ? formatARS(o.total) : "a confirmar"}
                </p>
                <p className="text-xs text-brand-dark/55">
                  {o.items.length} ítem{o.items.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            {/* Cambio de estado */}
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-brand-border pt-3">
              <span className="self-center text-xs text-brand-dark/50">
                Cambiar estado:
              </span>
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  disabled={busy === o.id || o.status === s}
                  onClick={() => handleStatus(o.id, s)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition disabled:opacity-50 ${
                    o.status === s
                      ? `${STATUS_STYLES[s]} ring-inset`
                      : "bg-surface text-brand-dark/70 ring-brand-border hover:bg-primary-light"
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
