"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  deleteTruck,
  subscribeTrucks,
  updateTruck,
  updateTruckCargo,
} from "@/lib/trucks";
import { incrementStock, setProductCost } from "@/lib/admin";
import { subscribePurchases } from "@/lib/cuentas";
import { formatARS, formatDate } from "@/lib/format";
import { coincide } from "@/lib/search";
import { useProducts } from "@/hooks/useProducts";
import {
  MARCAS,
  type Marca,
  type Purchase,
  type Truck,
  type TruckCargoItem,
} from "@/lib/types";

export default function AdminCamionesPage() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeTrucks((t) => {
      setTrucks(t);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => subscribePurchases(setPurchases), []);

  // Valor declarado de mercadería por camión (de los comprobantes A/B).
  const declaradoPorCamion = useMemo(() => {
    const m: Record<string, { A: number; B: number }> = {};
    purchases.forEach((p) => {
      if (!p.camionId) return;
      const slot = (m[p.camionId] ??= { A: 0, B: 0 });
      slot[p.modalidad] += p.monto || 0;
    });
    return m;
  }, [purchases]);

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar el camión "${nombre}"?`)) return;
    try {
      await deleteTruck(id);
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Los camiones se registran al cargar una compra en Cuentas Ctes */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-border bg-primary-light/30 p-4">
        <p className="text-sm text-brand-dark/75">
          🚚 Los camiones se registran al cargar una compra en{" "}
          <span className="font-semibold">Cuentas Ctes</span> → “Llegó un
          camión”. Acá ves la lista y editás la carga de cada uno.
        </p>
        <Link
          href="/admin/cuentas"
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          Ir a registrar un camión →
        </Link>
      </div>


      {/* === Lista === */}
      <section>
        <h2 className="mb-3 font-serif text-xl text-brand-dark">
          Camiones registrados
        </h2>
        {loading ? (
          <p className="text-brand-dark/60">Cargando…</p>
        ) : trucks.length === 0 ? (
          <div className="rounded-2xl border border-brand-border bg-surface p-8 text-center text-brand-dark/60">
            Todavía no hay camiones. Registrá el primero desde Cuentas Ctes →
            “Llegó un camión”.
          </div>
        ) : (
          <div className="space-y-3">
            {trucks.map((t) => (
              <TruckCard
                key={t.id}
                truck={t}
                declarado={declaradoPorCamion[t.id] ?? { A: 0, B: 0 }}
                onDelete={() => handleDelete(t.id, t.nombre)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ====== CARD DEL CAMIÓN (con expander de carga) ======
function TruckCard({
  truck,
  declarado,
  onDelete,
}: {
  truck: Truck;
  declarado: { A: number; B: number };
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pct, setPct] = useState(truck.porcentajeGanancia);
  const [savingPct, setSavingPct] = useState(false);
  const activo = !truck.fechaCierre;

  const guardarPct = async (v: number) => {
    if (v === truck.porcentajeGanancia) return;
    setSavingPct(true);
    try {
      await updateTruck(truck.id, { porcentajeGanancia: v });
    } catch {
      alert("No se pudo actualizar el % de ganancia.");
      setPct(truck.porcentajeGanancia);
    } finally {
      setSavingPct(false);
    }
  };
  const proveedorLabel =
    truck.proveedor === "otro"
      ? truck.proveedorOtro || "(sin nombre)"
      : truck.proveedor;
  const transporteLabel =
    truck.transporte === "otro"
      ? truck.transporteOtro || "(sin nombre)"
      : truck.transporte;

  const unidadesTotales = (truck.carga ?? []).reduce(
    (s, it) => s + it.cantidadUnidades,
    0
  );

  return (
    <article className="overflow-hidden rounded-xl border border-brand-border bg-surface transition hover:shadow-md">
      <div className="h-2 w-full" style={{ background: truck.color }} />
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div
            className="grid h-10 w-10 place-items-center rounded-full text-xl text-white shadow"
            style={{ background: truck.color }}
          >
            🚚
          </div>
          <div>
            <p className="font-semibold text-brand-dark">
              {truck.nombre}
              {activo && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Activo
                </span>
              )}
            </p>
            <p className="text-xs text-brand-dark/55">
              Ingreso: {formatDate(truck.fechaIngreso)}
              {truck.fechaCierre && <> · Cierre: {formatDate(truck.fechaCierre)}</>}
            </p>
            <p className="text-[11px] text-brand-dark/55">
              📋 {proveedorLabel || "—"} · 🚛 {transporteLabel || "—"}
            </p>
          </div>
        </div>
        <div className="text-right text-sm">
          <label className="flex items-center justify-end gap-1 text-primary">
            <input
              type="number"
              min={0}
              step={1}
              value={pct}
              disabled={savingPct}
              onChange={(e) => setPct(Number(e.target.value))}
              onBlur={() => guardarPct(Number(pct) || 0)}
              className="w-14 rounded border border-brand-border bg-white px-1.5 py-0.5 text-right text-sm font-semibold outline-none focus:border-primary disabled:opacity-60"
            />
            <span className="font-semibold">% ganancia</span>
          </label>
          {(truck.costoCamion ?? 0) > 0 && (
            <p className="mt-0.5 text-xs text-brand-dark/55">
              Logística: {formatARS(truck.costoCamion ?? 0)}
            </p>
          )}
        </div>
      </div>

      {truck.descripcion && (
        <p className="border-t border-brand-border bg-primary-light/30 px-4 py-2 text-xs italic text-brand-dark/70">
          {truck.descripcion}
        </p>
      )}

      <div className="border-t border-brand-border bg-slate-50/50 px-4 py-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-brand-dark/65">
            <b className="text-brand-dark">{(truck.carga ?? []).length}</b>{" "}
            ítem{(truck.carga ?? []).length === 1 ? "" : "s"} cargado
            {(truck.carga ?? []).length === 1 ? "" : "s"}
            {unidadesTotales > 0 && (
              <>
                {" "}
                ·{" "}
                <b className="text-brand-dark">{unidadesTotales}</b> unidades
              </>
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOpen((o) => !o)}
              className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-dark"
            >
              {open ? "Cerrar carga" : "Editar carga"}
            </button>
            <button
              onClick={onDelete}
              className="text-xs text-rose-700 hover:underline"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>

      {open && <CargoEditor truck={truck} declarado={declarado} />}
    </article>
  );
}

// ====== EDITOR DE CARGA — lista del catálogo con cantidad + costo por fila ======
function CargoEditor({
  truck,
  declarado,
}: {
  truck: Truck;
  declarado: { A: number; B: number };
}) {
  const productos = useProducts();

  type Row = { cantidad: number; costo: number; descripcion?: string };
  const [draft, setDraft] = useState<Record<string, Row>>(() => {
    const m: Record<string, Row> = {};
    (truck.carga ?? []).forEach((c) => {
      m[c.productId] = {
        cantidad: c.cantidadUnidades,
        costo: c.costoUnitario ?? 0,
        descripcion: c.descripcion,
      };
    });
    return m;
  });
  // Cantidades ya guardadas (para sumar al stock SOLO la diferencia al re-guardar).
  const [savedQty, setSavedQty] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    (truck.carga ?? []).forEach((c) => {
      m[c.productId] = c.cantidadUnidades;
    });
    return m;
  });
  const [busqueda, setBusqueda] = useState("");
  const [marca, setMarca] = useState<"todos" | Marca>("todos");
  const [soloCargados, setSoloCargados] = useState(false);
  const [verCargados, setVerCargados] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const filtrados = useMemo(() => {
    const t = busqueda.trim();
    return productos
      .filter((p) => (marca === "todos" ? true : p.marca === marca))
      .filter((p) => (soloCargados ? (draft[p.id]?.cantidad ?? 0) > 0 : true))
      .filter((p) =>
        !t ? true : coincide(p.nombre, t) || (p.ean ?? "").includes(t)
      )
      .sort((a, b) => {
        // Los productos con cantidad cargada van primero (no se pierden de vista).
        const la = (draft[a.id]?.cantidad ?? 0) > 0 ? 1 : 0;
        const lb = (draft[b.id]?.cantidad ?? 0) > 0 ? 1 : 0;
        return lb - la;
      });
  }, [productos, marca, busqueda, soloCargados, draft]);

  const setRow = (id: string, patch: Partial<Row>) => {
    setDraft((d) => {
      const prev = d[id] ?? { cantidad: 0, costo: 0 };
      return { ...d, [id]: { ...prev, ...patch } };
    });
    setDirty(true);
  };

  // Detalle de lo cargado (con nombre de producto) para el panel "Ver cargados".
  const cargados = useMemo(
    () =>
      Object.entries(draft)
        .filter(([, v]) => v.cantidad > 0)
        .map(([id, v]) => ({
          id,
          nombre: productos.find((p) => p.id === id)?.nombre ?? id,
          marca: productos.find((p) => p.id === id)?.marca,
          cantidad: v.cantidad,
          costo: v.costo,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [draft, productos]
  );
  const totalUnidades = cargados.reduce((s, v) => s + v.cantidad, 0);
  const totalCosto = cargados.reduce((s, v) => s + v.cantidad * (v.costo || 0), 0);

  const guardar = async () => {
    setBusy(true);
    try {
      const next: TruckCargoItem[] = Object.entries(draft)
        .filter(([, v]) => v.cantidad > 0 && v.costo > 0)
        .map(([id, v]) => {
          const p = productos.find((x) => x.id === id);
          const item: TruckCargoItem = {
            productId: id,
            producto: p?.nombre ?? "",
            cantidadUnidades: v.cantidad,
            costoUnitario: v.costo,
            precioVentaOptimo: 0,
          };
          // Firestore rechaza undefined → solo incluimos descripción si tiene texto.
          const desc = v.descripcion?.trim();
          if (desc) item.descripcion = desc;
          return item;
        });

      // 1) Guardar la carga del camión (alimenta el reporte por camión).
      await updateTruckCargo(truck.id, next);

      // 2) Actualizar STOCK por la diferencia vs lo ya guardado (no duplica al
      //    re-guardar; si bajás la cantidad, descuenta) + actualizar COSTO.
      const ids = new Set<string>([
        ...Object.keys(savedQty),
        ...next.map((i) => i.productId),
      ]);
      const nextMap: Record<string, number> = {};
      next.forEach((i) => (nextMap[i.productId] = i.cantidadUnidades));
      for (const id of ids) {
        const nuevo = nextMap[id] ?? 0;
        const anterior = savedQty[id] ?? 0;
        const delta = nuevo - anterior;
        if (delta !== 0) await incrementStock(id, delta);
        const costo = draft[id]?.costo ?? 0;
        if (nuevo > 0 && costo > 0) await setProductCost(id, costo);
      }

      setSavedQty(nextMap);
      setDirty(false);
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar la carga.");
    } finally {
      setBusy(false);
    }
  };

  const MARCA_TABS: ("todos" | Marca)[] = [
    "todos",
    "doncella",
    "nonisec",
    "lenterdit",
  ];

  const totalDeclarado = declarado.A + declarado.B;
  const diferencia = totalDeclarado - totalCosto; // >0 falta cargar · <0 cargaste de más

  return (
    <div className="border-t border-brand-border bg-primary-light/20 p-4">
      {/* Valor declarado de la mercadería (comprobantes A/B) vs lo cargado */}
      <div className="mb-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-brand-border bg-brand-border sm:grid-cols-4">
        <div className="bg-surface px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-brand-dark/55">
            Declarado A (facturado)
          </p>
          <p className="font-serif text-base text-brand-dark">
            {declarado.A > 0 ? formatARS(declarado.A) : "—"}
          </p>
        </div>
        <div className="bg-surface px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-brand-dark/55">
            Declarado B (sin facturar)
          </p>
          <p className="font-serif text-base text-brand-dark">
            {declarado.B > 0 ? formatARS(declarado.B) : "—"}
          </p>
        </div>
        <div className="bg-surface px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-brand-dark/55">
            Total declarado
          </p>
          <p className="font-serif text-base font-semibold text-brand-dark">
            {totalDeclarado > 0 ? formatARS(totalDeclarado) : "—"}
          </p>
        </div>
        <div className="bg-surface px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-brand-dark/55">
            Cargado / Diferencia
          </p>
          <p className="font-serif text-base font-semibold text-rose-700">
            {formatARS(totalCosto)}
          </p>
          {totalDeclarado > 0 && (
            <p
              className={`text-[10px] font-medium ${
                diferencia === 0
                  ? "text-emerald-700"
                  : diferencia > 0
                  ? "text-amber-700"
                  : "text-rose-700"
              }`}
            >
              {diferencia === 0
                ? "✓ Coincide con lo declarado"
                : diferencia > 0
                ? `Falta cargar ${formatARS(diferencia)}`
                : `Cargaste ${formatARS(-diferencia)} de más`}
            </p>
          )}
        </div>
      </div>

      {/* Controles: buscador + filtro por marca + solo cargados */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o código de barras…"
          className="min-w-[200px] flex-1 rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <div className="flex flex-wrap gap-1">
          {MARCA_TABS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMarca(m)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                marca === m
                  ? "bg-primary text-white"
                  : "bg-white text-brand-dark/70 ring-1 ring-brand-border hover:bg-primary-light/40"
              }`}
            >
              {m === "todos" ? "Todas" : MARCAS[m]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSoloCargados((s) => !s)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            soloCargados
              ? "bg-emerald-600 text-white"
              : "bg-white text-brand-dark/70 ring-1 ring-brand-border hover:bg-emerald-50"
          }`}
        >
          {soloCargados ? "Ver todos" : `Solo cargados (${cargados.length})`}
        </button>
      </div>

      {/* Resumen + guardar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-border bg-surface px-3 py-2 text-xs">
        <button
          type="button"
          onClick={() => setVerCargados((v) => !v)}
          className="flex items-center gap-1 text-left text-brand-dark/70 hover:text-brand-dark"
          title="Ver el detalle de lo cargado"
        >
          <span className="text-brand-dark/45">{verCargados ? "▲" : "▼"}</span>
          <span>
            <b className="text-brand-dark">{cargados.length}</b> producto
            {cargados.length === 1 ? "" : "s"} ·{" "}
            <b className="text-brand-dark">{totalUnidades}</b> unidades · costo{" "}
            <b className="text-rose-700">{formatARS(totalCosto)}</b>
          </span>
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={busy || !dirty}
          className="rounded-lg bg-primary px-4 py-1.5 font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {busy ? "Guardando…" : dirty ? "Guardar carga" : "Guardado ✓"}
        </button>
      </div>

      {/* Panel: lo que está cargado en el camión */}
      {verCargados && (
        <div className="mb-3 overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50/40">
          {cargados.length === 0 ? (
            <p className="px-3 py-3 text-xs text-brand-dark/55">
              Todavía no cargaste productos. Poné cantidad y costo en la lista de
              abajo.
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-emerald-100/70 text-[10px] uppercase text-emerald-800">
                <tr>
                  <th className="px-2 py-1.5 text-left">Producto cargado</th>
                  <th className="w-[70px] px-2 py-1.5 text-right">Cant.</th>
                  <th className="w-[100px] px-2 py-1.5 text-right">Costo u.</th>
                  <th className="w-[110px] px-2 py-1.5 text-right">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {cargados.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-emerald-200/60 first:border-t-0"
                  >
                    <td className="px-2 py-1.5">
                      {c.marca && (
                        <span className="mr-1 rounded bg-slate-100 px-1 text-[9px] font-bold uppercase text-slate-600">
                          {c.marca}
                        </span>
                      )}
                      {c.nombre}
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold">
                      {c.cantidad}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {formatARS(c.costo)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold text-rose-700">
                      {formatARS(c.cantidad * c.costo)}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => setRow(c.id, { cantidad: 0 })}
                        className="text-rose-600 hover:opacity-70"
                        title="Quitar de la carga"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Lista del catálogo */}
      <div className="max-h-[420px] overflow-auto rounded-lg border border-brand-border bg-surface">
        <table className="w-full min-w-[480px] text-xs">
          <thead className="sticky top-0 bg-primary-light/60 text-[10px] uppercase text-primary">
            <tr>
              <th className="px-2 py-2 text-left">Producto</th>
              <th className="w-[70px] px-2 py-2 text-right">Stock</th>
              <th className="w-[90px] px-2 py-2 text-right">Cantidad</th>
              <th className="w-[120px] px-2 py-2 text-right">Costo u. (ARS)</th>
              <th className="w-[90px] px-2 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-2 py-6 text-center text-brand-dark/45"
                >
                  Sin resultados.
                </td>
              </tr>
            ) : (
              filtrados.map((p) => {
                const row = draft[p.id] ?? { cantidad: 0, costo: 0 };
                const enc = row.cantidad > 0;
                return (
                  <tr
                    key={p.id}
                    className={`border-t border-brand-border/50 ${
                      enc ? "bg-emerald-50/60" : ""
                    }`}
                  >
                    <td className="px-2 py-1.5">
                      <p className="line-clamp-1 text-brand-dark">
                        <span className="mr-1 rounded bg-slate-100 px-1 text-[9px] font-bold uppercase text-slate-600">
                          {p.marca}
                        </span>
                        {p.nombre}
                      </p>
                    </td>
                    <td className="px-2 py-1.5 text-right text-brand-dark/60">
                      {p.stock ?? 0}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={row.cantidad || ""}
                        placeholder="0"
                        onChange={(e) =>
                          setRow(p.id, { cantidad: Number(e.target.value) })
                        }
                        className="w-full rounded border border-brand-border bg-white px-1.5 py-1 text-right outline-none focus:border-primary"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step="any"
                        value={row.costo || ""}
                        placeholder="0"
                        onChange={(e) =>
                          setRow(p.id, { costo: Number(e.target.value) })
                        }
                        className="w-full rounded border border-rose-200 bg-white px-1.5 py-1 text-right outline-none focus:border-rose-400"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold text-rose-700">
                      {enc && row.costo > 0
                        ? formatARS(row.cantidad * row.costo)
                        : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px] text-brand-dark/55">
        Poné cantidad y costo a los productos que trae el camión y tocá{" "}
        <b>Guardar carga</b>: se <b>suma al stock</b> y se actualiza el{" "}
        <b>costo</b> de cada producto. El precio de venta al público se maneja
        aparte en <code>/admin/productos</code>.
      </p>
    </div>
  );
}
