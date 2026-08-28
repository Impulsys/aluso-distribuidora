"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  subscribeClientes,
  createCliente,
  updateCliente,
  deleteCliente,
  type NewClienteInput,
} from "@/lib/clientes";
import { coincide } from "@/lib/search";
import { getAllUsers } from "@/lib/admin";
import { LISTAS_PRECIO } from "@/lib/precios";
import {
  CONDICION_IVA_LABELS,
  type AppUser,
  type Cliente,
  type CondicionIva,
} from "@/lib/types";

const VACIO: NewClienteInput = {
  nombre: "",
  razonSocial: "",
  cuit: "",
  condicionIva: "consumidor_final",
  email: "",
  telefono: "",
  direccionEntrega: "",
  domicilioFiscal: "",
  markupLista: 28,
  descuentoExtraPct: 0,
  observaciones: "",
  entregaDirectaFabrica: false,
};

export default function ClientesPage() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<NewClienteInput>(VACIO);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState("");
  const [vendedores, setVendedores] = useState<AppUser[]>([]);

  useEffect(() => subscribeClientes(setClientes), []);
  useEffect(() => {
    getAllUsers()
      .then((us) => setVendedores(us.filter((u) => u.role === "vendedor")))
      .catch(() => {});
  }, []);

  const set = <K extends keyof NewClienteInput>(k: K, v: NewClienteInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const visibles = useMemo(() => {
    const t = q.trim();
    if (!t) return clientes;
    return clientes.filter(
      (c) =>
        coincide(c.nombre, t) ||
        coincide(c.razonSocial ?? "", t) ||
        (c.cuit ?? "").includes(t)
    );
  }, [clientes, q]);

  const reset = () => {
    setEditId(null);
    setForm(VACIO);
  };

  const editar = (c: Cliente) => {
    setEditId(c.id);
    setForm({
      nombre: c.nombre,
      razonSocial: c.razonSocial ?? "",
      cuit: c.cuit ?? "",
      condicionIva: c.condicionIva ?? "consumidor_final",
      email: c.email ?? "",
      telefono: c.telefono ?? "",
      direccionEntrega: c.direccionEntrega ?? "",
      domicilioFiscal: c.domicilioFiscal ?? "",
      vendedorId: c.vendedorId ?? "",
      vendedorNombre: c.vendedorNombre ?? "",
      markupLista: c.markupLista ?? 28,
      descuentoExtraPct: c.descuentoExtraPct ?? 0,
      observaciones: c.observaciones ?? "",
      entregaDirectaFabrica: c.entregaDirectaFabrica ?? false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const guardar = async () => {
    if (!form.nombre.trim()) {
      alert("Poné al menos el nombre del cliente.");
      return;
    }
    setBusy(true);
    try {
      if (editId) {
        await updateCliente(editId, form);
        setOk("Cliente actualizado ✓");
      } else {
        await createCliente({
          ...form,
          // Vendedor ASIGNADO al cliente (elegido en la ficha); si no se eligió,
          // queda quien lo cargó. Este vendedor se autocompleta después en Ventas.
          vendedorId: form.vendedorId || user?.uid,
          vendedorNombre: form.vendedorNombre || user?.displayName,
        });
        setOk("Cliente creado ✓");
      }
      reset();
      setTimeout(() => setOk(""), 2500);
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar el cliente.");
    } finally {
      setBusy(false);
    }
  };

  const borrar = async (c: Cliente) => {
    if (!confirm(`¿Eliminar a "${c.nombre}"?`)) return;
    await deleteCliente(c.id);
    if (editId === c.id) reset();
  };

  const inputCls =
    "mt-1 w-full rounded-lg border border-brand-border px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-serif text-2xl text-brand-dark">Clientes</h2>
        <p className="text-sm text-brand-dark/60">
          Datos de los clientes. Se pueden elegir al vender para autocompletar la
          venta y la factura.
        </p>
      </div>

      {/* Formulario */}
      <div className="rounded-2xl border border-brand-border bg-surface p-4 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-brand-dark">
            {editId ? "Editar cliente" : "Nuevo cliente"}
          </h3>
          {editId && (
            <button
              onClick={reset}
              className="rounded-lg bg-primary-light px-3 py-1.5 text-sm font-medium text-primary"
            >
              + Crear otro
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-brand-dark">Nombre / contacto</span>
            <input
              value={form.nombre}
              onChange={(e) => set("nombre", e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-brand-dark">Razón social</span>
            <input
              value={form.razonSocial}
              onChange={(e) => set("razonSocial", e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-brand-dark">CUIT</span>
            <input
              value={form.cuit}
              onChange={(e) => set("cuit", e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-brand-dark">Condición IVA</span>
            <select
              value={form.condicionIva}
              onChange={(e) =>
                set("condicionIva", e.target.value as CondicionIva)
              }
              className={inputCls}
            >
              {(Object.keys(CONDICION_IVA_LABELS) as CondicionIva[]).map((c) => (
                <option key={c} value={c}>
                  {CONDICION_IVA_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-brand-dark">Lista de precios</span>
            <select
              value={form.markupLista ?? 28}
              onChange={(e) =>
                set("markupLista", Number(e.target.value) || 28)
              }
              className={inputCls}
            >
              {LISTAS_PRECIO.map((l) => (
                <option key={l.markup} value={l.markup}>
                  {l.nombre} ({l.markup}%)
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-brand-dark">
              Descuento extra (%)
            </span>
            <input
              type="number"
              min={0}
              max={90}
              step="any"
              value={form.descuentoExtraPct ?? ""}
              onChange={(e) =>
                set("descuentoExtraPct", Math.max(0, Number(e.target.value) || 0))
              }
              placeholder="0"
              className={inputCls}
            />
            <span className="mt-0.5 block text-[11px] text-brand-dark/45">
              Se aplica solo cuando elegís este cliente en la venta.
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-brand-dark">
              Vendedor asignado
            </span>
            <select
              value={form.vendedorId ?? ""}
              onChange={(e) => {
                const v = vendedores.find((x) => x.uid === e.target.value);
                setForm((f) => ({
                  ...f,
                  vendedorId: v?.uid ?? "",
                  vendedorNombre: v?.displayName ?? "",
                }));
              }}
              className={inputCls}
            >
              <option value="">— Sin asignar —</option>
              {vendedores.map((v) => (
                <option key={v.uid} value={v.uid}>
                  {v.displayName}
                </option>
              ))}
            </select>
            <span className="mt-0.5 block text-[11px] text-brand-dark/45">
              Se autocompleta al elegir este cliente en la venta (se puede
              cambiar ahí).
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-brand-dark">Teléfono</span>
            <input
              value={form.telefono}
              onChange={(e) => set("telefono", e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-brand-dark">Email</span>
            <input
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-brand-dark">
              Dirección de entrega
            </span>
            <input
              value={form.direccionEntrega}
              onChange={(e) => set("direccionEntrega", e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-brand-dark">Domicilio fiscal</span>
            <input
              value={form.domicilioFiscal}
              onChange={(e) => set("domicilioFiscal", e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-brand-dark">Observaciones</span>
            <textarea
              value={form.observaciones ?? ""}
              onChange={(e) => set("observaciones", e.target.value)}
              rows={2}
              placeholder="Notas del cliente: horarios de entrega, quién recibe, etc."
              className={inputCls}
            />
          </label>
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.entregaDirectaFabrica ?? false}
              onChange={(e) => set("entregaDirectaFabrica", e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="font-medium text-brand-dark">
                🏭 Entrega directa de fábrica
              </span>
              <span className="block text-[11px] text-brand-dark/45">
                El pedido se despacha desde la fábrica, no desde el depósito. Al
                facturarle, la venta <b>no descuenta stock</b> (pero sí cuenta como
                venta y deuda del cliente).
              </span>
            </span>
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={guardar}
            disabled={busy}
            className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-primary-dark disabled:opacity-60"
          >
            {busy ? "Guardando…" : editId ? "Guardar cambios" : "Crear cliente"}
          </button>
          {ok && <span className="text-sm font-medium text-emerald-700">{ok}</span>}
        </div>
      </div>

      {/* Lista */}
      <div className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="font-semibold text-brand-dark">
            Clientes ({clientes.length})
          </h3>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, razón social o CUIT…"
            className="ml-auto w-full rounded-lg border border-brand-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary sm:max-w-xs"
          />
        </div>

        {visibles.length === 0 ? (
          <p className="rounded-xl border border-brand-border bg-surface px-4 py-8 text-center text-sm text-brand-dark/50">
            {clientes.length === 0
              ? "Todavía no hay clientes. Creá el primero arriba."
              : "Sin resultados."}
          </p>
        ) : (
          <ul className="space-y-2">
            {visibles.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-border bg-surface p-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-brand-dark">{c.nombre}</p>
                  <p className="truncate text-xs text-brand-dark/55">
                    {[
                      c.razonSocial,
                      c.cuit && `CUIT ${c.cuit}`,
                      c.telefono,
                      c.direccionEntrega,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sin datos adicionales"}
                  </p>
                </div>
                <button
                  onClick={() => editar(c)}
                  className="rounded-lg bg-primary-light px-3 py-1.5 text-xs font-semibold text-primary"
                >
                  Editar
                </button>
                <button
                  onClick={() => borrar(c)}
                  className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
