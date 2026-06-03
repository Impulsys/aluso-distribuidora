"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useProducts } from "@/hooks/useProducts";
import {
  setProductOverride,
  setProductCost,
  subscribeProductCosts,
  deleteProduct,
  uploadProductImage,
  createProduct,
} from "@/lib/admin";
import { formatARS } from "@/lib/format";
import { coincide } from "@/lib/search";
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
  const [crearOpen, setCrearOpen] = useState(false);
  const [costs, setCosts] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsub = subscribeProductCosts(setCosts);
    return unsub;
  }, []);

  const handleDelete = async (p: Product) => {
    if (
      !confirm(
        `¿Eliminar "${p.nombre}"? Se quita del catálogo. (Podés volver a darlo de alta después.)`
      )
    )
      return;
    try {
      await deleteProduct(p.id);
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar el producto.");
    }
  };

  const visible = useMemo(
    () =>
      productos
        .filter((p) => (marca === "todos" ? true : p.marca === marca))
        .filter((p) => {
          const t = q.trim();
          if (!t) return true;
          return coincide(p.nombre, t) || coincide(p.ean ?? "", t);
        }),
    [productos, marca, q]
  );

  const destacadosCount = productos.filter((p) => p.destacado).length;
  const patrimonio = productos.reduce(
    (s, p) => s + (p.stock || 0) * (costs[p.id] ?? 0),
    0
  );

  return (
    <div>
      {/* Patrimonio en stock */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-surface p-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-brand-dark/55">
            Patrimonio en stock
          </p>
          <p className="mt-1 font-serif text-3xl font-medium text-emerald-700">
            {patrimonio > 0 ? formatARS(patrimonio) : "—"}
          </p>
        </div>
        <p className="max-w-[16rem] text-right text-[11px] text-brand-dark/45">
          Valor de la mercadería en depósito (stock × precio de costo de cada
          producto).
        </p>
      </div>

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
          placeholder="Buscar por nombre o código de barras…"
          className="w-full rounded-lg border border-brand-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary sm:max-w-xs"
        />
        <button
          onClick={() => setCrearOpen(true)}
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark sm:ml-auto"
        >
          ＋ Crear producto
        </button>
      </div>

      {/* Tabla de productos */}
      <div className="overflow-hidden rounded-xl border border-brand-border bg-surface">
        <div className="hidden grid-cols-[100px_minmax(0,1fr)_110px_100px_100px_90px_64px_100px_64px_52px] gap-3 border-b border-brand-border bg-primary-light px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-primary md:grid">
          <span></span>
          <span>Producto</span>
          <span>Cód. barras</span>
          <span className="text-center">Cód. producto</span>
          <span className="text-right">P. venta</span>
          <span className="text-right">P. costo</span>
          <span className="text-right">Stock</span>
          <span className="text-right">Valor stock</span>
          <span className="text-center">Destac.</span>
          <span className="text-center">Activo</span>
        </div>

        {visible.map((p) => (
          <ProductRow
            key={p.id}
            p={p}
            costo={costs[p.id] ?? 0}
            destacadosCount={destacadosCount}
            editing={editing === p.id}
            onToggleEdit={() => setEditing(editing === p.id ? null : p.id)}
            onDelete={() => handleDelete(p)}
          />
        ))}

        {/* Total valor en stock (de lo mostrado) */}
        <div className="flex items-center justify-between gap-3 border-t-2 border-brand-border bg-primary-light/40 px-4 py-2.5 text-sm">
          <span className="font-medium text-brand-dark/70">
            Total valor en stock{" "}
            <span className="text-brand-dark/45">
              ({visible.length} producto{visible.length === 1 ? "" : "s"})
            </span>
          </span>
          <span className="font-serif text-lg font-semibold text-primary">
            {formatARS(
              visible.reduce(
                (s, p) => s + (p.stock || 0) * (costs[p.id] ?? 0),
                0
              )
            )}
          </span>
        </div>
      </div>

      {crearOpen && <CrearProductoModal onClose={() => setCrearOpen(false)} />}
    </div>
  );
}

function CrearProductoModal({ onClose }: { onClose: () => void }) {
  const [nombre, setNombre] = useState("");
  const [marca, setMarca] = useState<Marca>("nonisec");
  const [ean, setEan] = useState("");
  const [codigo, setCodigo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [precioVenta, setPrecioVenta] = useState(0);
  const [precioCosto, setPrecioCosto] = useState(0);
  const [stock, setStock] = useState(0);
  const [descripcion, setDescripcion] = useState("");
  const [imagen, setImagen] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    if (!nombre.trim()) {
      setError("Poné un nombre al producto.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = await createProduct({
        nombre: nombre.trim(),
        marca,
        ean: ean.trim() || undefined,
        codigo: codigo.trim() || undefined,
        categoria: categoria.trim() || undefined,
        precioVenta: Number(precioVenta) || 0,
        descripcion: descripcion.trim() || undefined,
        imagen: imagen.trim() || undefined,
        stock: Number(stock) || 0,
      });
      if (file) {
        const url = await uploadProductImage(id, file);
        await setProductOverride(id, { imagen: url });
      }
      if (Number(precioCosto) > 0) await setProductCost(id, Number(precioCosto));
      onClose();
    } catch (e) {
      console.error(e);
      setError("No se pudo crear el producto. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-brand-border p-5">
          <h2 className="font-serif text-xl text-brand-dark">Nuevo producto</h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
          >
            ✕
          </button>
        </div>
        <div className="space-y-3 p-5">
          <Field label="Nombre del producto">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre"
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Marca">
              <select
                value={marca}
                onChange={(e) => setMarca(e.target.value as Marca)}
                className={inputCls}
              >
                {(Object.keys(MARCAS) as Marca[]).map((m) => (
                  <option key={m} value={m}>
                    {MARCAS[m]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Categoría">
              <input
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="General"
                className={inputCls}
              />
            </Field>
            <Field label="Código de barras">
              <input
                value={ean}
                onChange={(e) => setEan(e.target.value)}
                placeholder="779…"
                className={inputCls}
              />
            </Field>
            <Field label="Código de producto">
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="SKU interno"
                className={inputCls}
              />
            </Field>
            <Field label="Precio de venta (ARS)">
              <input
                type="number"
                min={0}
                value={precioVenta || ""}
                onChange={(e) => setPrecioVenta(Number(e.target.value))}
                className={inputCls}
              />
            </Field>
            <Field label="Precio de costo (ARS)">
              <input
                type="number"
                min={0}
                value={precioCosto || ""}
                onChange={(e) => setPrecioCosto(Number(e.target.value))}
                className={inputCls}
              />
            </Field>
            <Field label="Stock (unidades)">
              <input
                type="number"
                min={0}
                value={stock || ""}
                onChange={(e) => setStock(Number(e.target.value))}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Foto del producto">
            <div className="flex items-center gap-3">
              <label className="inline-block cursor-pointer rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-dark">
                {file ? "✓ Foto elegida" : "📷 Elegir foto"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <input
                value={imagen}
                onChange={(e) => setImagen(e.target.value)}
                placeholder="…o pegá una URL"
                className="flex-1 rounded-lg border border-brand-border bg-white px-2 py-1.5 text-xs outline-none focus:border-primary"
              />
            </div>
          </Field>

          <Field label="Descripción (opcional)">
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              placeholder="Descripción del producto…"
              className={`resize-y ${inputCls}`}
            />
          </Field>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-brand-border px-4 py-2 text-sm font-medium hover:bg-primary-light"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={busy}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {busy ? "Creando…" : "Crear producto"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductRow({
  p,
  costo,
  destacadosCount,
  editing,
  onToggleEdit,
  onDelete,
}: {
  p: Product;
  costo: number;
  destacadosCount: number;
  editing: boolean;
  onToggleEdit: () => void;
  onDelete: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const save = async (patch: Partial<Product> & { _costo?: number }) => {
    setBusy(true);
    try {
      // Separar precioCosto: va a /productCosts (admin-only)
      const { _costo, ...publicPatch } = patch;
      await setProductOverride(p.id, publicPatch);
      if (typeof _costo === "number") {
        await setProductCost(p.id, _costo);
      }
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
      <div className="grid grid-cols-[80px_1fr_auto] items-center gap-3 px-4 py-3 md:grid-cols-[100px_minmax(0,1fr)_110px_100px_100px_90px_64px_100px_64px_52px]">
        <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-brand-border bg-white md:h-24 md:w-24">
          <Image
            src={p.imagen}
            alt={p.nombre}
            fill
            sizes="96px"
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
        <span className="hidden text-center font-mono text-xs text-brand-dark/70 md:block">
          {p.codigo || "—"}
        </span>
        <span className="hidden text-right font-semibold text-primary md:block">
          {p.precioVenta > 0 ? formatARS(p.precioVenta) : "—"}
          {(p.precioOferta ?? 0) > 0 && (
            <span className="ml-1 rounded bg-accent px-1 text-[9px] text-white">
              OF
            </span>
          )}
        </span>
        <span className="hidden text-right text-brand-dark/70 md:block">
          {costo > 0 ? formatARS(costo) : "—"}
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
        <span className="hidden text-right text-brand-dark/70 md:block">
          {(p.stock || 0) * costo > 0
            ? formatARS((p.stock || 0) * costo)
            : "—"}
        </span>
        <span className="hidden text-center md:block">
          {p.destacado ? "⭐" : "—"}
        </span>
        <span className="hidden text-center md:block">
          {p.activo ? "✓" : "✗"}
        </span>
        <div className="col-start-3 row-span-2 flex items-center gap-1.5 md:col-auto md:row-auto">
          <button
            onClick={onToggleEdit}
            className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-dark"
          >
            {editing ? "Cerrar" : "Editar"}
          </button>
          <button
            onClick={onDelete}
            title="Eliminar producto"
            aria-label="Eliminar producto"
            className="grid h-8 w-8 place-items-center rounded-full text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-600 hover:text-white hover:ring-rose-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              stroke="currentColor"
              className="h-[18px] w-[18px]"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Form de edición */}
      {editing && (
        <div className="border-t border-brand-border bg-primary-light/40 px-4 py-4">
          <EditForm
            p={p}
            costo={costo}
            busy={busy}
            destacadosCount={destacadosCount}
            onSave={save}
          />
        </div>
      )}
    </div>
  );
}

function EditForm({
  p,
  costo,
  busy,
  destacadosCount,
  onSave,
}: {
  p: Product;
  costo: number;
  busy: boolean;
  destacadosCount: number;
  onSave: (patch: Partial<Product> & { _costo?: number }) => Promise<void>;
}) {
  const [nombre, setNombre] = useState(p.nombre);
  const [codigo, setCodigo] = useState(p.codigo ?? "");
  const [imagen, setImagen] = useState(p.imagen);
  const [categoria, setCategoria] = useState(p.categoria);
  const [marca, setMarca] = useState<Marca>(p.marca);
  const [precioVenta, setPrecioVenta] = useState(p.precioVenta);
  const [precioCosto, setPrecioCosto] = useState(costo);
  const [stock, setStock] = useState(p.stock);
  const [destacado, setDestacado] = useState(p.destacado ?? false);
  const [precioOferta, setPrecioOferta] = useState(p.precioOferta ?? 0);
  const [activo, setActivo] = useState(p.activo);
  const [descripcion, setDescripcion] = useState(p.descripcion ?? "");
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendo(true);
    setError(null);
    try {
      const url = await uploadProductImage(p.id, file);
      setImagen(url);
    } catch (err) {
      console.error(err);
      setError("No se pudo subir la foto. Probá de nuevo.");
    } finally {
      setSubiendo(false);
      e.target.value = "";
    }
  };

  // Si este producto NO es destacado y ya hay 3+ destacados → no puede marcarlo
  const destacadoBloqueado = !p.destacado && destacadosCount >= 3;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validaciones
    const pv = Number(precioVenta) || 0;
    const pc = Number(precioCosto) || 0;
    const st = Number(stock) || 0;
    const po = Number(precioOferta) || 0;

    if (pv < 0 || pc < 0 || st < 0 || po < 0) {
      setError("Los valores no pueden ser negativos.");
      return;
    }
    if (po > 0 && pv > 0 && po >= pv) {
      setError(
        "El precio de oferta debe ser MENOR que el precio de venta (sino no es oferta)."
      );
      return;
    }
    if (destacado && !p.destacado && destacadosCount >= 3) {
      setError(
        "Ya hay 3 productos destacados. Desmarcá uno antes de agregar éste."
      );
      return;
    }
    if (!nombre.trim()) {
      setError("El nombre no puede estar vacío.");
      return;
    }

    onSave({
      nombre: nombre.trim(),
      codigo: codigo.trim(),
      imagen: imagen.trim(),
      categoria: categoria.trim() || "General",
      marca,
      precioVenta: pv,
      _costo: pc, // precio costo va a colección admin-only
      stock: st,
      destacado,
      precioOferta: po,
      activo,
      descripcion: descripcion.trim(),
    });
  };

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div className="sm:col-span-2 lg:col-span-3">
        <Field label="Nombre del producto">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre"
            className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </Field>
      </div>
      <Field label="Código de producto">
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Código interno / SKU"
          className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </Field>
      <Field label="Categoría">
        <input
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          placeholder="General"
          className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </Field>
      <Field label="Marca">
        <select
          value={marca}
          onChange={(e) => setMarca(e.target.value as Marca)}
          className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm"
        >
          {(Object.keys(MARCAS) as Marca[]).map((m) => (
            <option key={m} value={m}>
              {MARCAS[m]}
            </option>
          ))}
        </select>
      </Field>
      <div className="sm:col-span-2 lg:col-span-3">
        <Field label="Foto del producto">
          <div className="flex items-center gap-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-brand-border bg-white">
              {imagen ? (
                <Image
                  src={imagen}
                  alt="Foto"
                  fill
                  sizes="64px"
                  className="object-contain p-1"
                />
              ) : (
                <span className="grid h-full w-full place-items-center text-[10px] text-brand-dark/40">
                  sin foto
                </span>
              )}
            </div>
            <div className="flex-1">
              <label className="inline-block cursor-pointer rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-dark">
                {subiendo ? "Subiendo…" : "📷 Subir foto"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={subiendo}
                  onChange={onPickFile}
                />
              </label>
              <input
                value={imagen}
                onChange={(e) => setImagen(e.target.value)}
                placeholder="…o pegá una URL de imagen"
                className="mt-2 w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-xs outline-none focus:border-primary"
              />
            </div>
          </div>
        </Field>
      </div>

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
        <label
          className={`flex items-center gap-2 text-sm ${
            destacadoBloqueado ? "opacity-60" : ""
          }`}
        >
          <input
            type="checkbox"
            checked={destacado}
            disabled={destacadoBloqueado}
            onChange={(e) => setDestacado(e.target.checked)}
          />
          ⭐ Mostrar en el banner de destacados
        </label>
        {destacadoBloqueado && (
          <p className="mt-1 text-[11px] text-amber-700">
            Ya hay 3 destacados (máx). Desmarcá uno primero.
          </p>
        )}
      </Field>

      <div className="sm:col-span-2 lg:col-span-3">
        <Field label="Descripción (visible en el catálogo)">
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={4}
            placeholder="Descripción del producto…"
            className="w-full resize-y rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </Field>
      </div>

      <div className="sm:col-span-2 lg:col-span-3">
        {error && (
          <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {error}
          </p>
        )}
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
