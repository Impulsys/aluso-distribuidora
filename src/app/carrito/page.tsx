"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { formatARS, tsFromISO } from "@/lib/format";
import { pedidoCarritoLink } from "@/lib/order";
import { createOrder } from "@/lib/orders";
import { subscribeClientes, createCliente } from "@/lib/clientes";
import {
  CONDICION_IVA_LABELS,
  type Cliente,
  type CondicionIva,
  type FormaPago,
} from "@/lib/types";

const FORMAS: { id: FormaPago; label: string; emoji: string }[] = [
  { id: "efectivo", label: "Efectivo", emoji: "💵" },
  { id: "cheque", label: "Cheque", emoji: "🧾" },
  { id: "transferencia", label: "Transferencia", emoji: "🏦" },
];

export default function CarritoPage() {
  const { items, total, count, setQty, remove, clear } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [nota, setNota] = useState("");
  const [formaPago, setFormaPago] = useState<FormaPago>("efectivo");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clientes (CRM) + entrega
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSel, setClienteSel] = useState<Cliente | null>(null);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [horario, setHorario] = useState("");

  const isVendedor =
    user?.role === "vendedor" || user?.role === "superadmin";

  useEffect(() => subscribeClientes(setClientes), []);

  const elegirCliente = (id: string) => {
    const c = clientes.find((x) => x.id === id) ?? null;
    setClienteSel(c);
    if (c) {
      setNombre(c.nombre);
      if (c.telefono) setTelefono(c.telefono);
    }
  };

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
        clienteId: clienteSel?.id,
        clienteCuit: clienteSel?.cuit,
        clienteRazonSocial: clienteSel?.razonSocial,
        clienteCondicionIva: clienteSel?.condicionIva,
        clienteDireccion: clienteSel?.direccionEntrega,
        fechaEntrega: fechaEntrega ? tsFromISO(fechaEntrega) : undefined,
        horarioEntrega: horario.trim() || undefined,
        notas: nota.trim() || undefined,
        formaPago,
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
                className="grid h-10 w-10 place-items-center rounded border border-brand-border hover:bg-primary-light sm:h-9 sm:w-9"
                aria-label="Restar"
              >
                −
              </button>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min={1}
                max={999}
                value={i.cantidad}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setQty(
                    i.productId,
                    Math.max(1, Math.min(999, Number.isFinite(n) ? n : 1))
                  );
                }}
                className="h-10 w-14 rounded border border-brand-border text-center sm:h-9"
              />
              <button
                onClick={() =>
                  setQty(i.productId, Math.min(999, i.cantidad + 1))
                }
                className="grid h-10 w-10 place-items-center rounded border border-brand-border hover:bg-primary-light sm:h-9 sm:w-9"
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
        {isVendedor && (
          <div>
            <label className="text-sm font-medium">
              Cliente guardado
              <select
                value={clienteSel?.id ?? ""}
                onChange={(e) => elegirCliente(e.target.value)}
                className="mt-1 w-full rounded-lg border border-brand-border bg-white px-3 py-2 outline-none focus:border-primary"
              >
                <option value="">— Sin cliente / nombre manual —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                    {c.razonSocial ? ` · ${c.razonSocial}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setNuevoOpen((v) => !v)}
              className="mt-2 rounded-lg bg-primary-light px-3 py-1.5 text-xs font-semibold text-primary"
            >
              {nuevoOpen ? "Cerrar" : "➕ Nuevo cliente"}
            </button>
            {nuevoOpen && (
              <NuevoClienteInline
                vendedorId={user?.uid}
                vendedorNombre={user?.displayName}
                onCreated={(c) => {
                  setClienteSel(c);
                  setNombre(c.nombre);
                  if (c.telefono) setTelefono(c.telefono);
                  setNuevoOpen(false);
                }}
              />
            )}
          </div>
        )}

        <label className="text-sm font-medium">
          {isVendedor ? "Nombre del cliente" : "Tu nombre (opcional)"}
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={isVendedor ? "Nombre del cliente" : "Ej: Pedro Gómez"}
            className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 outline-none focus:border-primary"
          />
        </label>
        {isVendedor && (
          <>
            <label className="text-sm font-medium">
              Teléfono del cliente
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej: 387 555-1234"
                className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 outline-none focus:border-primary"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium">
                Fecha de entrega
                <input
                  type="date"
                  value={fechaEntrega}
                  onChange={(e) => setFechaEntrega(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 outline-none focus:border-primary"
                />
              </label>
              <label className="text-sm font-medium">
                Horario
                <input
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  placeholder="ej. 10 a 12"
                  className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 outline-none focus:border-primary"
                />
              </label>
            </div>
          </>
        )}
        <div>
          <span className="block text-sm font-medium">
            Forma de pago{isVendedor && " del cliente"}
          </span>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {FORMAS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormaPago(f.id)}
                className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                  formaPago === f.id
                    ? "border-primary bg-primary text-white shadow-sm"
                    : "border-brand-border bg-surface hover:border-primary"
                }`}
              >
                <div className="text-lg">{f.emoji}</div>
                {f.label}
              </button>
            ))}
          </div>
        </div>

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

// ===== Alta rápida de cliente desde el carrito (vendedor) =====
function NuevoClienteInline({
  vendedorId,
  vendedorNombre,
  onCreated,
}: {
  vendedorId?: string;
  vendedorNombre?: string;
  onCreated: (c: Cliente) => void;
}) {
  const [f, setF] = useState({
    nombre: "",
    razonSocial: "",
    cuit: "",
    condicionIva: "consumidor_final" as CondicionIva,
    telefono: "",
    email: "",
    direccionEntrega: "",
    domicilioFiscal: "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const cls =
    "mt-1 w-full rounded-lg border border-brand-border px-3 py-2 text-sm outline-none focus:border-primary";

  const guardar = async () => {
    if (!f.nombre.trim()) {
      alert("Poné al menos el nombre del cliente.");
      return;
    }
    setBusy(true);
    try {
      const id = await createCliente({ ...f, vendedorId, vendedorNombre });
      onCreated({ id, createdAt: Date.now(), ...f } as Cliente);
    } catch (e) {
      console.error(e);
      alert("No se pudo crear el cliente.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 grid gap-2 rounded-lg border border-dashed border-brand-border bg-primary-light/20 p-3">
      <input
        value={f.nombre}
        onChange={(e) => set("nombre", e.target.value)}
        placeholder="Nombre / contacto *"
        className={cls}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={f.razonSocial}
          onChange={(e) => set("razonSocial", e.target.value)}
          placeholder="Razón social"
          className={cls}
        />
        <input
          value={f.cuit}
          onChange={(e) => set("cuit", e.target.value)}
          placeholder="CUIT"
          className={cls}
        />
      </div>
      <select
        value={f.condicionIva}
        onChange={(e) => set("condicionIva", e.target.value)}
        className={cls}
      >
        {(Object.keys(CONDICION_IVA_LABELS) as CondicionIva[]).map((c) => (
          <option key={c} value={c}>
            {CONDICION_IVA_LABELS[c]}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={f.telefono}
          onChange={(e) => set("telefono", e.target.value)}
          placeholder="Teléfono"
          className={cls}
        />
        <input
          value={f.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="Email"
          className={cls}
        />
      </div>
      <input
        value={f.direccionEntrega}
        onChange={(e) => set("direccionEntrega", e.target.value)}
        placeholder="Dirección de entrega"
        className={cls}
      />
      <input
        value={f.domicilioFiscal}
        onChange={(e) => set("domicilioFiscal", e.target.value)}
        placeholder="Domicilio fiscal"
        className={cls}
      />
      <button
        type="button"
        onClick={guardar}
        disabled={busy}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Guardando…" : "Guardar cliente"}
      </button>
    </div>
  );
}
