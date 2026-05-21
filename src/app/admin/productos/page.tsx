"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useProducts } from "@/hooks/useProducts";
import { setProductOverride } from "@/lib/admin";
import { formatARS } from "@/lib/format";
import { MARCAS, type Marca, type Product } from "@/lib/types";

type MarcaFilter = "todos" | Marca;

const MARCA_CHIP: Record<Marca, string> = {
  doncella: "bg-rose-600",
  nonisec: "bg-sky-700",
  lenterdit: "bg-emerald-700",
};

export default function AdminProductosPage() {
  const productos = useProducts();
  const [marca, setMarca] = useState<MarcaFilter>("todos");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      productos
        .filter((p) => (marca === "todos" ? true : p.marca === marca))
        .filter((p) => {
          if (!q.trim()) return true;
          const t = q.toLowerCase();
          return (
            p.nombre.toLowerCase().includes(t) ||
            (p.ean ?? "").toLowerCase().includes(t)
          );
        }),
    [productos, marca, q]
  );

  const destacadosCount = productos.filter((p) => p.destacado).length;

  return (
    <div>
      {/* Cabecera con stats */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-brand-dark/60">
        <span>
          {visible.length} de {productos.length} productos
        </span>
        <span>·</span>
        <span>
          <b className="text-accent">{destacadosCount}</b> destacado
          {destacadosCount === 1 ? "" : "s"} en el banner
        </span>
        {destacadosCount > 3 && (
          <span className="text-amber-700">
            ⚠️ Solo los primeros 3 destacados aparecen en el banner
          </span>
        )}
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="inline-flex overflow-hidden rounded-xl bg-surface p-1 ring-1 ring-brand-border">
          {(["todos", "doncella", "nonisec"] as MarcaFilter[]).map((m) => (
            <button
              key={m}
              onClick={() => setMarca(m)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                marca === m
                  ? "bg-primary text-white"
                  : "text-brand-dark hover:bg-primary-light"
              }`}
            >
              {m === "todos" ? "Todos" : MARCAS[m as Marca]}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o EAN…"
          className="w-full rounded-lg border border-brand-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary sm:max-w-xs"
        />
      </div>

      {/* Tabla de productos */}
      <div className="overflow-hidden rounded-xl border border-brand-border bg-surface">
        <div className="hidden grid-cols-[64px_minmax(0,1fr)_120px_110px_90px_90px_80px_60px] gap-3 border-b border-brand-border bg-primary-light px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-primary md:grid">
          <span></span>
          <span>Producto</span>
          <span>EAN</span>
          <span>P. venta</span>
          <span>P. costo</span>
          <span>Stock</span>
          <span className="text-center">Destacado</span>
          <span className="text-center">Activo</span>
        </div>

        {visible.map((p) => (
          <ProductRow
            key={p.id}
            p={p}
            editing={editing === p.id}
            onToggleEdit={() => setEditing(editing === p.id ? null : p.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ProductRow({
  p,
  editing,
  onToggleEdit,
}: {
  p: Product;
  editing: boolean;
  onToggleEdit: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const save = async (patch: Partial<Product>) => {
    setBusy(true);
    try {
      await setProductOverride(p.id, patch);
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-b border-brand-border last:border-b-0">
      {/* Fila lectura */}
      <div className="grid grid-cols-[48px_1fr_auto] items-center gap-3 px-4 py-3 md:grid-cols-[64px_minmax(0,1fr)_120px_110px_90px_90px_80px_60px]">
        <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-primary-light md:h-14 md:w-14">
          <Image
            src={p.imagen}
            alt={p.nombre}
            fill
            sizes="64px"
            className="object-contain p-1"
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white ${MARCA_CHIP[p.marca]}`}
            >
              {p.marca}
            </span>
            <span className="text-[11px] text-brand-dark/55">
              {p.categoria}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-sm font-medium text-brand-dark">
            {p.nombre}
          </p>
        </div>
        <span className="hidden font-mono text-xs text-brand-dark/55 md:block">
          {p.ean ?? "—"}
        </span>
        <span className="hidden text-right font-semibold text-primary md:block">
          {p.precioVenta > 0 ? formatARS(p.precioVenta) : "—"}
          {p.precioOferta && p.precioOferta > 0 && (
            <span className="ml-1 rounded bg-accent px-1 text-[9px] text-white">
              OF
            </span>
          )}
        </span>
        <span className="hidden text-right text-brand-dark/70 md:block">
          {p.precioCosto > 0 ? formatARS(p.precioCosto) : "—"}
        </span>
        <span
          className={`hidden text-right md:block ${
            p.stock === 0
              ? "text-rose-600"
              : p.stock < 10
              ? "text-amber-700"
              : "text-brand-dark/70"
          }`}
        >
          {p.stock}
        </span>
        <span className="hidden text-center md:block">
          {p.destacado ? "⭐" : "—"}
        </span>
        <span className="hidden text-center md:block">
          {p.activo ? "✓" : "✗"}
        </span>
        <button
          onClick={onToggleEdit}
          className="col-start-3 row-span-2 md:col-auto md:row-auto"
        >
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-dark">
            {editing ? "Cerrar" : "Editar"}
          </span>
        </button>
      </div>

      {/* Form de edición */}
      {editing && (
        <div className="border-t border-brand-border bg-primary-light/40 px-4 py-4">
          <EditForm p={p} busy={busy} onSave={save} />
        </div>
      )}
    </div>
  );
}

function EditForm({
  p,
  busy,
  onSave,
}: {
  p: Product;
  busy: boolean;
  onSave: (patch: Partial<Product>) => Promise<void>;
}) {
  const [precioVenta, setPrecioVenta] = useState(p.precioVenta);
  const [precioCosto, setPrecioCosto] = useState(p.precioCosto);
  const [stock, setStock] = useState(p.stock);
  const [destacado, setDestacado] = useState(p.destacado ?? false);
  const [precioOferta, setPrecioOferta] = useState(p.precioOferta ?? 0);
  const [activo, setActivo] = useState(p.activo);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      precioVenta: Number(precioVenta) || 0,
      precioCosto: Number(precioCosto) || 0,
      stock: Number(stock) || 0,
      destacado,
      precioOferta: Number(precioOferta) || 0,
      activo,
    });
  };

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <Field label="Precio de venta (ARS)">
        <input
          type="number"
          min={0}
          step={1}
          value={precioVenta}
          onChange={(e) => setPrecioVenta(Number(e.target.value))}
          className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Precio de costo (oculto al vendedor)">
        <input
          type="number"
          min={0}
          step={1}
          value={precioCosto}
          onChange={(e) => setPrecioCosto(Number(e.target.value))}
          className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Stock (unidades)">
        <input
          type="number"
          min={0}
          step={1}
          value={stock}
          onChange={(e) => setStock(Number(e.target.value))}
          className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Precio de OFERTA (0 = sin oferta)">
        <input
          type="number"
          min={0}
          step={1}
          value={precioOferta}
          onChange={(e) => setPrecioOferta(Number(e.target.value))}
          className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Estado">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
          />
          Producto activo (visible en el catálogo)
        </label>
      </Field>
      <Field label="Banner destacado">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={destacado}
            onChange={(e) => setDestacado(e.target.checked)}
          />
          ⭐ Mostrar en el banner de destacados
        </label>
      </Field>

      <div className="sm:col-span-2 lg:col-span-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-white shadow hover:bg-primary-dark disabled:opacity-60"
        >
          {busy ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-brand-dark/70">
        {label}
      </span>
      {children}
    </label>
  );
}
