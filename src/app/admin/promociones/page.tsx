"use client";

import { useEffect, useMemo, useState } from "react";
import { useProducts } from "@/hooks/useProducts";
import {
  PALETAS,
  BADGES_SUGERIDOS,
  getPaleta,
  subscribePromos,
  createPromo,
  updatePromo,
  deletePromo,
  setPromoActivo,
  setPromoOrden,
  type NewPromoInput,
} from "@/lib/promos";
import PromoBanner from "@/components/PromoBanner";
import { coincide } from "@/lib/search";
import type { Promocion } from "@/lib/types";

const VACIO: NewPromoInput = {
  productId: "",
  badge: "OFERTA",
  titulo: "",
  texto: "",
  paleta: "violeta",
  mostrarPrecio: true,
  activo: true,
  orden: 0,
};

export default function PromocionesPage() {
  const productos = useProducts();
  const [promos, setPromos] = useState<Promocion[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<NewPromoInput>(VACIO);
  const [filtro, setFiltro] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState("");

  useEffect(() => subscribePromos(setPromos), []);

  const set = <K extends keyof NewPromoInput>(k: K, v: NewPromoInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const selectedProduct = useMemo(
    () => productos.find((p) => p.id === form.productId),
    [productos, form.productId]
  );

  const productosFiltrados = useMemo(() => {
    const t = filtro.trim();
    const activos = productos.filter((p) => p.activo);
    if (!t) return activos.slice(0, 60);
    return activos
      .filter((p) => coincide(p.nombre, t) || coincide(p.ean ?? "", t))
      .slice(0, 60);
  }, [productos, filtro]);

  const resetForm = () => {
    setEditId(null);
    setForm(VACIO);
    setFiltro("");
  };

  const handleEdit = (p: Promocion) => {
    setEditId(p.id);
    setForm({
      productId: p.productId,
      badge: p.badge,
      titulo: p.titulo ?? "",
      texto: p.texto,
      paleta: p.paleta,
      mostrarPrecio: p.mostrarPrecio,
      activo: p.activo,
      orden: p.orden ?? 0,
    });
    setFiltro("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async () => {
    if (!form.productId) {
      alert("Elegí un producto para la promoción.");
      return;
    }
    if (!form.badge.trim() && !form.texto.trim()) {
      alert("Poné al menos un cartel (OFERTA/PROMOCIÓN) o un texto.");
      return;
    }
    setBusy(true);
    try {
      if (editId) {
        await updatePromo(editId, form);
        setOk("Promoción actualizada ✓");
      } else {
        await createPromo({ ...form, orden: promos.length });
        setOk("Promoción publicada ✓");
      }
      resetForm();
      setTimeout(() => setOk(""), 2500);
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar la promoción.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (p: Promocion) => {
    if (!confirm("¿Eliminar esta promoción del catálogo?")) return;
    await deletePromo(p.id);
    if (editId === p.id) resetForm();
  };

  // Reordenar: intercambia el orden con el vecino.
  const mover = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= promos.length) return;
    const a = promos[i];
    const b = promos[j];
    await Promise.all([
      setPromoOrden(a.id, b.orden ?? j),
      setPromoOrden(b.id, a.orden ?? i),
    ]);
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-serif text-2xl text-brand-dark">Promociones</h2>
        <p className="text-sm text-brand-dark/60">
          Armá el banner destacado del catálogo. Elegí un producto, escribí la
          oferta, ponele un cartel y un color, mirá la vista previa y publicá.
          Las promociones activas rotan en el carrusel del catálogo.
        </p>
      </div>

      {/* ===== Editor ===== */}
      <div className="rounded-2xl border border-brand-border bg-surface p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-brand-dark">
            {editId ? "Editar promoción" : "Nueva promoción"}
          </h3>
          {editId && (
            <button
              onClick={resetForm}
              className="rounded-lg bg-primary-light px-3 py-1.5 text-sm font-medium text-primary"
            >
              + Crear otra
            </button>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Form */}
          <div className="space-y-4">
            {/* Producto */}
            <div>
              <label className="block text-sm font-medium text-brand-dark">
                Producto
              </label>
              <input
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar producto por nombre o código…"
                className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <select
                value={form.productId}
                onChange={(e) => set("productId", e.target.value)}
                size={5}
                className="mt-2 w-full rounded-lg border border-brand-border bg-white px-2 py-1 text-sm outline-none focus:border-primary"
              >
                {productosFiltrados.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Cartel */}
            <div>
              <label className="block text-sm font-medium text-brand-dark">
                Cartel (OFERTA / PROMOCIÓN / 2x1…)
              </label>
              <input
                value={form.badge}
                onChange={(e) => set("badge", e.target.value)}
                list="badges-sugeridos"
                placeholder="OFERTA"
                className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <datalist id="badges-sugeridos">
                {BADGES_SUGERIDOS.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>

            {/* Título */}
            <div>
              <label className="block text-sm font-medium text-brand-dark">
                Título{" "}
                <span className="font-normal text-brand-dark/50">
                  (opcional — si lo dejás vacío usa el nombre del producto)
                </span>
              </label>
              <input
                value={form.titulo}
                onChange={(e) => set("titulo", e.target.value)}
                placeholder={selectedProduct?.nombre || "Título de la promo"}
                className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>

            {/* Texto */}
            <div>
              <label className="block text-sm font-medium text-brand-dark">
                Texto de la oferta
              </label>
              <textarea
                value={form.texto}
                onChange={(e) => set("texto", e.target.value)}
                rows={2}
                placeholder="Ej: Llevá 3 unidades y la 4ª es de regalo 🎁"
                className="mt-1 w-full resize-none rounded-lg border border-brand-border px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>

            {/* Paleta */}
            <div>
              <label className="block text-sm font-medium text-brand-dark">
                Color de fondo
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {PALETAS.map((pal) => (
                  <button
                    key={pal.id}
                    type="button"
                    onClick={() => set("paleta", pal.id)}
                    title={pal.label}
                    className={`h-9 w-9 rounded-full ring-2 ring-offset-2 transition ${
                      form.paleta === pal.id
                        ? "ring-brand-dark"
                        : "ring-transparent hover:ring-brand-dark/30"
                    }`}
                    style={{ background: pal.bg }}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-brand-dark/50">
                {getPaleta(form.paleta).label}
              </p>
            </div>

            {/* Opciones */}
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-brand-dark/80">
                <input
                  type="checkbox"
                  checked={form.mostrarPrecio}
                  onChange={(e) => set("mostrarPrecio", e.target.checked)}
                />
                Mostrar precio
              </label>
              <label className="flex items-center gap-2 text-sm text-brand-dark/80">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => set("activo", e.target.checked)}
                />
                Activa (visible en el catálogo)
              </label>
            </div>
          </div>

          {/* Vista previa */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">
              Vista previa
            </p>
            <PromoBanner promo={form} product={selectedProduct} />
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={busy}
                className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-primary-dark disabled:opacity-60"
              >
                {busy
                  ? "Guardando…"
                  : editId
                  ? "Guardar cambios"
                  : "Publicar promoción"}
              </button>
              {ok && (
                <span className="text-sm font-medium text-emerald-700">
                  {ok}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Lista de promociones ===== */}
      <div className="mt-6">
        <h3 className="mb-3 font-semibold text-brand-dark">
          Promociones cargadas ({promos.length})
        </h3>
        {promos.length === 0 ? (
          <p className="rounded-xl border border-brand-border bg-surface px-4 py-8 text-center text-sm text-brand-dark/50">
            Todavía no hay promociones. Creá la primera arriba.
          </p>
        ) : (
          <ul className="space-y-2">
            {promos.map((p, i) => {
              const prod = productos.find((x) => x.id === p.productId);
              const pal = getPaleta(p.paleta);
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-border bg-surface p-3"
                >
                  <span
                    className="h-9 w-9 shrink-0 rounded-full"
                    style={{ background: pal.bg }}
                    title={pal.label}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                        style={{ background: pal.acento }}
                      >
                        {p.badge}
                      </span>
                      <span className="truncate font-medium text-brand-dark">
                        {p.titulo || prod?.nombre || "Producto eliminado"}
                      </span>
                    </div>
                    {p.texto && (
                      <p className="truncate text-xs text-brand-dark/55">
                        {p.texto}
                      </p>
                    )}
                  </div>

                  {/* Orden */}
                  <div className="flex flex-col">
                    <button
                      onClick={() => mover(i, -1)}
                      disabled={i === 0}
                      className="px-2 text-brand-dark/50 disabled:opacity-20"
                      aria-label="Subir"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => mover(i, 1)}
                      disabled={i === promos.length - 1}
                      className="px-2 text-brand-dark/50 disabled:opacity-20"
                      aria-label="Bajar"
                    >
                      ▼
                    </button>
                  </div>

                  <button
                    onClick={() => setPromoActivo(p.id, !p.activo)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      p.activo
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {p.activo ? "Activa" : "Oculta"}
                  </button>
                  <button
                    onClick={() => handleEdit(p)}
                    className="rounded-lg bg-primary-light px-3 py-1.5 text-xs font-semibold text-primary"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                  >
                    Eliminar
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
