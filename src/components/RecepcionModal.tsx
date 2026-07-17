"use client";

import { useMemo, useState } from "react";
import { useProducts } from "@/hooks/useProducts";
import { createProduct, incrementStock, setProductCost } from "@/lib/admin";
import { formatARS } from "@/lib/format";
import { coincide } from "@/lib/search";
import { MARCAS, type Marca } from "@/lib/types";

interface Props {
  proveedorNombre?: string;
  onClose: () => void;
}

interface Line {
  key: string;
  productId?: string; // existente
  nombre: string;
  cantidad: number;
  costo: number;
  nuevo?: { ean?: string; marca: Marca; categoria: string };
  // Ya sumó stock en Firestore. Si la carga se corta a la mitad y el usuario
  // reintenta, estos NO se vuelven a sumar (antes se duplicaba el stock).
  cargado?: boolean;
}

let lineSeq = 0;
const nextKey = () => `l${lineSeq++}`;

export default function RecepcionModal({ proveedorNombre, onClose }: Props) {
  const productos = useProducts();
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form producto nuevo
  const [showNuevo, setShowNuevo] = useState(false);
  const [nNombre, setNNombre] = useState("");
  const [nEan, setNEan] = useState("");
  const [nMarca, setNMarca] = useState<Marca>("nonisec");
  const [nCategoria, setNCategoria] = useState("");

  const resultados = useMemo(() => {
    const t = q.trim();
    if (!t) return [];
    return productos
      .filter((p) => coincide(p.nombre, t) || (p.ean ?? "").includes(t))
      .slice(0, 8);
  }, [productos, q]);

  const addExistente = (id: string, nombre: string) => {
    if (lines.some((l) => l.productId === id)) return;
    setLines((prev) => [
      ...prev,
      { key: nextKey(), productId: id, nombre, cantidad: 1, costo: 0 },
    ]);
    setQ("");
  };

  const addNuevo = () => {
    if (!nNombre.trim()) return;
    setLines((prev) => [
      ...prev,
      {
        key: nextKey(),
        nombre: nNombre.trim(),
        cantidad: 1,
        costo: 0,
        nuevo: {
          ean: nEan.trim() || undefined,
          marca: nMarca,
          categoria: nCategoria.trim() || "General",
        },
      },
    ]);
    setNNombre("");
    setNEan("");
    setNCategoria("");
    setShowNuevo(false);
  };

  const updateLine = (key: string, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const removeLine = (key: string) =>
    setLines((prev) => prev.filter((l) => l.key !== key));

  const total = lines.reduce((s, l) => s + l.cantidad * l.costo, 0);

  const confirmar = async () => {
    // Los que ya entraron en un intento anterior NO se vuelven a cargar.
    const pendientes = lines.filter((l) => l.cantidad > 0 && !l.cargado);
    if (pendientes.length === 0) {
      setError(
        lines.some((l) => l.cargado)
          ? "Ya se cargó todo. Cerrá la ventana."
          : "Agregá al menos un producto con cantidad."
      );
      return;
    }
    setBusy(true);
    setError(null);
    let hechos = 0;
    try {
      for (const l of pendientes) {
        let id = l.productId;
        if (!id && l.nuevo) {
          id = await createProduct({
            nombre: l.nombre,
            marca: l.nuevo.marca,
            ean: l.nuevo.ean,
            categoria: l.nuevo.categoria,
          });
          // Guardamos el id: si hay que reintentar, no se crea otra vez.
          const nuevoId = id;
          setLines((prev) =>
            prev.map((x) => (x.key === l.key ? { ...x, productId: nuevoId } : x))
          );
        }
        if (!id) continue;
        await incrementStock(
          id,
          l.cantidad,
          `recepción de mercadería${proveedorNombre ? ` · ${proveedorNombre}` : ""}`
        );
        if (l.costo > 0) await setProductCost(id, l.costo);
        hechos++;
        setLines((prev) =>
          prev.map((x) => (x.key === l.key ? { ...x, cargado: true } : x))
        );
      }
      onClose();
    } catch (e) {
      console.error(e);
      setError(
        hechos > 0
          ? `Se cargaron ${hechos} de ${pendientes.length} productos y falló el resto. ` +
              `Volvé a apretar "Confirmar": se cargan SOLO los que faltan (los ✓ ya entraron).`
          : "No se pudo guardar la recepción. Intentá de nuevo."
      );
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/50 backdrop-blur-sm sm:place-items-center">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-brand-border p-5">
          <div>
            <h2 className="font-serif text-2xl text-brand-dark">
              Recepción de mercadería
            </h2>
            <p className="text-sm text-brand-dark/60">
              Cargá los productos que llegaron{proveedorNombre ? ` de ${proveedorNombre}` : ""}. Se suman al stock.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
          >
            ✕
          </button>
        </div>

        <div className="p-5">
          {/* Buscador */}
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-brand-dark/55">
            Buscar producto (nombre o código de barras)
          </label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ej: pañal adulto, o 779094…"
            className={inputCls}
          />
          {resultados.length > 0 && (
            <div className="mt-1 overflow-hidden rounded-lg border border-brand-border">
              {resultados.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addExistente(p.id, p.nombre)}
                  className="flex w-full items-center justify-between gap-2 border-b border-brand-border/60 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-primary-light/40"
                >
                  <span className="line-clamp-1">{p.nombre}</span>
                  <span className="shrink-0 font-mono text-[11px] text-brand-dark/45">
                    {p.ean ?? "—"}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Crear nuevo */}
          <div className="mt-2">
            {!showNuevo ? (
              <button
                onClick={() => setShowNuevo(true)}
                className="text-sm font-medium text-primary hover:underline"
              >
                ＋ Crear producto nuevo
              </button>
            ) : (
              <div className="rounded-lg border border-brand-border bg-primary-light/20 p-3">
                <p className="mb-2 text-xs font-semibold text-brand-dark">
                  Producto nuevo
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    value={nNombre}
                    onChange={(e) => setNNombre(e.target.value)}
                    placeholder="Nombre del producto"
                    className={inputCls}
                  />
                  <input
                    value={nEan}
                    onChange={(e) => setNEan(e.target.value)}
                    placeholder="Código de barras (opcional)"
                    className={inputCls}
                  />
                  <select
                    value={nMarca}
                    onChange={(e) => setNMarca(e.target.value as Marca)}
                    className={inputCls}
                  >
                    {(Object.keys(MARCAS) as Marca[]).map((m) => (
                      <option key={m} value={m}>
                        {MARCAS[m]}
                      </option>
                    ))}
                  </select>
                  <input
                    value={nCategoria}
                    onChange={(e) => setNCategoria(e.target.value)}
                    placeholder="Categoría (opcional)"
                    className={inputCls}
                  />
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={addNuevo}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark"
                  >
                    Agregar a la recepción
                  </button>
                  <button
                    onClick={() => setShowNuevo(false)}
                    className="rounded-lg px-3 py-1.5 text-xs text-brand-dark/60 hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Líneas */}
          <div className="mt-4">
            {lines.length === 0 ? (
              <p className="rounded-lg border border-dashed border-brand-border p-4 text-center text-sm text-brand-dark/45">
                Todavía no agregaste productos.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-brand-border">
                <div className="grid grid-cols-[1fr_70px_100px_90px_32px] gap-2 bg-primary-light/40 px-3 py-1.5 text-[10px] font-bold uppercase text-primary">
                  <span>Producto</span>
                  <span className="text-right">Cant.</span>
                  <span className="text-right">Costo u.</span>
                  <span className="text-right">Subtotal</span>
                  <span />
                </div>
                {lines.map((l) => (
                  <div
                    key={l.key}
                    className={`grid grid-cols-[1fr_70px_100px_90px_32px] items-center gap-2 border-t border-brand-border px-3 py-2 text-sm ${
                      l.cargado ? "bg-emerald-50/70" : ""
                    }`}
                  >
                    <span className="line-clamp-1">
                      {l.cargado && (
                        <span
                          className="mr-1 font-bold text-emerald-700"
                          title="Ya sumó stock — no se vuelve a cargar"
                        >
                          ✓
                        </span>
                      )}
                      {l.nombre}
                      {l.nuevo && (
                        <span className="ml-1 rounded bg-emerald-100 px-1 text-[9px] font-bold uppercase text-emerald-800">
                          nuevo
                        </span>
                      )}
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={l.cantidad || ""}
                      disabled={l.cargado}
                      onChange={(e) =>
                        updateLine(l.key, { cantidad: Number(e.target.value) })
                      }
                      className="rounded border border-brand-border px-1.5 py-1 text-right text-xs disabled:bg-slate-100 disabled:text-brand-dark/50"
                    />
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={l.costo || ""}
                      disabled={l.cargado}
                      onChange={(e) =>
                        updateLine(l.key, { costo: Number(e.target.value) })
                      }
                      className="rounded border border-brand-border px-1.5 py-1 text-right text-xs disabled:bg-slate-100 disabled:text-brand-dark/50"
                    />
                    <span className="text-right font-semibold">
                      {formatARS(l.cantidad * l.costo)}
                    </span>
                    <button
                      onClick={() => removeLine(l.key)}
                      disabled={l.cargado}
                      className="text-rose-600 hover:opacity-70 disabled:cursor-not-allowed disabled:text-brand-dark/25"
                      title={
                        l.cargado
                          ? "Ya sumó stock: para sacarlo, corregí el stock en Productos"
                          : "Quitar"
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t-2 border-brand-border bg-primary-light/30 px-3 py-2 text-sm font-bold">
                  <span>Total recepción</span>
                  <span>{formatARS(total)}</span>
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900">
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-brand-border px-4 py-2 text-sm font-medium hover:bg-primary-light"
            >
              Cerrar sin cargar
            </button>
            <button
              onClick={confirmar}
              disabled={busy || lines.length === 0}
              className="rounded-lg bg-primary px-5 py-2 font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {busy ? "Guardando…" : "Confirmar recepción"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
