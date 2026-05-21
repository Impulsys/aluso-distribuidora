"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { formatARS } from "@/lib/format";
import { pedidoCarritoLink } from "@/lib/order";
import { createOrder } from "@/lib/orders";

export default function CarritoPage() {
  const { items, total, count, setQty, remove, clear } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [nota, setNota] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isVendedor =
    user?.role === "vendedor" || user?.role === "superadmin";

  if (count === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Tu carrito está vacío</h1>
        <p className="mt-2 text-brand-dark/60">
          Agregá productos del catálogo y armá tu pedido.
        </p>
        <Link
          href={isVendedor ? "/vendedor" : "/catalogo"}
          className="mt-6 inline-block rounded bg-primary px-5 py-2.5 font-medium text-white"
        >
          Ir al catálogo
        </Link>
      </div>
    );
  }

  const link = pedidoCarritoLink(items, total, { nombre, nota });

  // ====== Flujo VENDEDOR: registra en Firestore + abre WhatsApp ======
  const registrarPedido = async () => {
    if (!user) return;
    setSubmitting(true);
    setError(null);
    try {
      await createOrder({
        origin: "vendedor",
        createdBy: user.uid,
        createdByName: user.displayName,
        items,
        total,
        clienteNombre: nombre.trim() || undefined,
        clienteTelefono: telefono.trim() || undefined,
        notas: nota.trim() || undefined,
      });
      // Abrimos WhatsApp aparte (popup) y luego limpiamos
      window.open(link, "_blank", "noopener,noreferrer");
      clear();
      router.push("/vendedor/pedidos");
    } catch (e) {
      console.error(e);
      setError(
        "No se pudo registrar el pedido. Revisá la conexión e intentá de nuevo."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-primary">
        {isVendedor ? "Registrar pedido" : "Tu pedido"}
      </h1>
      <p className="mt-1 text-sm text-brand-dark/60">
        {count} ítem{count === 1 ? "" : "s"} ·{" "}
        {isVendedor
          ? "Completá los datos del cliente y registralo en la plataforma."
          : "Revisalo y enviá por WhatsApp"}
      </p>

      <div className="mt-6 divide-y divide-brand-border overflow-hidden rounded-xl border border-brand-border bg-surface">
        {items.map((i) => (
          <div key={i.productId} className="flex items-center gap-3 p-3 sm:p-4">
            <div className="flex-1">
              <p className="font-medium leading-tight">{i.nombre}</p>
              <p className="text-xs text-brand-dark/60">
                {formatARS(i.precioVenta)} c/u
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setQty(i.productId, i.cantidad - 1)}
                className="grid h-8 w-8 place-items-center rounded border border-brand-border hover:bg-primary-light"
                aria-label="Restar"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                value={i.cantidad}
                onChange={(e) =>
                  setQty(i.productId, Math.max(1, Number(e.target.value) || 1))
                }
                className="h-8 w-12 rounded border border-brand-border text-center"
              />
              <button
                onClick={() => setQty(i.productId, i.cantidad + 1)}
                className="grid h-8 w-8 place-items-center rounded border border-brand-border hover:bg-primary-light"
                aria-label="Sumar"
              >
                +
              </button>
            </div>
            <div className="w-24 text-right font-semibold text-primary">
              {i.precioVenta > 0 ? formatARS(i.precioVenta * i.cantidad) : "—"}
            </div>
            <button
              onClick={() => remove(i.productId)}
              className="ml-1 text-accent hover:opacity-70"
              aria-label="Quitar"
              title="Quitar"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-brand-border bg-surface p-4">
        <span className="text-lg font-bold">Total</span>
        <span className="text-2xl font-bold text-primary">
          {items.some((i) => i.precioVenta <= 0)
            ? "a confirmar"
            : formatARS(total)}
        </span>
      </div>

      <div className="mt-6 grid gap-3 rounded-xl border border-brand-border bg-surface p-4">
        <label className="text-sm font-medium">
          {isVendedor ? "Cliente" : "Tu nombre (opcional)"}
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={isVendedor ? "Nombre del cliente" : "Ej: Pedro Gómez"}
            className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 outline-none focus:border-primary"
          />
        </label>
        {isVendedor && (
          <label className="text-sm font-medium">
            Teléfono del cliente
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Ej: 387 555-1234"
              className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 outline-none focus:border-primary"
            />
          </label>
        )}
        <label className="text-sm font-medium">
          Nota / dirección (opcional)
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Calle, barrio, referencia, horario, etc."
            rows={2}
            className="mt-1 w-full resize-none rounded-lg border border-brand-border px-3 py-2 outline-none focus:border-primary"
          />
        </label>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {isVendedor ? (
          <button
            onClick={registrarPedido}
            disabled={submitting}
            className="flex-1 rounded-lg bg-primary px-5 py-3 font-semibold text-white shadow transition hover:bg-primary-dark disabled:opacity-60"
          >
            {submitting ? "Registrando…" : "✓ Registrar y enviar por WhatsApp"}
          </button>
        ) : (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg bg-[#25D366] px-5 py-3 text-center font-semibold text-white shadow hover:opacity-90"
          >
            Enviar pedido por WhatsApp
          </a>
        )}
        <button
          onClick={() => {
            if (confirm("¿Vaciar el carrito?")) clear();
          }}
          disabled={submitting}
          className="rounded-lg border border-brand-border bg-surface px-5 py-3 font-medium hover:bg-primary-light disabled:opacity-60"
        >
          Vaciar
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-brand-dark/50">
        {isVendedor
          ? "El pedido queda guardado en la plataforma + se abre WhatsApp con el detalle precargado."
          : "Al enviar se abre WhatsApp con tu pedido precargado. La distribuidora te confirma stock y coordina el pago."}
      </p>
    </div>
  );
}
