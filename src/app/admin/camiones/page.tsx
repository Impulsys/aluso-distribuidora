"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createTruck,
  deleteTruck,
  subscribeTrucks,
  updateTruckCargo,
} from "@/lib/trucks";
import { formatARS, formatDate } from "@/lib/format";
import { useProducts } from "@/hooks/useProducts";
import { useAuth } from "@/context/AuthContext";
import {
  subscribeProveedores,
  seedProveedoresIfEmpty,
  createPurchase,
} from "@/lib/cuentas";
import {
  TRANSPORTES,
  type Product,
  type Proveedor,
  type Truck,
  type TruckCargoItem,
} from "@/lib/types";

const PRESET_COLORS = [
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#10B981",
  "#06B6D4",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#A16207",
  "#475569",
];

function todayISO() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t.toISOString().slice(0, 10);
}

export default function AdminCamionesPage() {
  const { user } = useAuth();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[5]);
  const [fechaIngreso, setFechaIngreso] = useState(todayISO());
  const [porcentaje, setPorcentaje] = useState(35);
  const [costo, setCosto] = useState(0);
  // proveedorSel = id del proveedor (Firestore) | "otro" | ""
  const [proveedorSel, setProveedorSel] = useState<string>("");
  const [proveedorOtro, setProveedorOtro] = useState("");
  const [transporte, setTransporte] = useState<string>(TRANSPORTES[0]);
  const [transporteOtro, setTransporteOtro] = useState("");
  const [descripcion, setDescripcion] = useState("");
  // Compra al proveedor (deuda)
  const [numeroFactura, setNumeroFactura] = useState(""); // A (facturado)
  const [montoFactura, setMontoFactura] = useState(0);
  const [numeroRemito, setNumeroRemito] = useState(""); // B (sin facturar)
  const [montoRemito, setMontoRemito] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeTrucks((t) => {
      setTrucks(t);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    seedProveedoresIfEmpty().catch(() => {});
    const unsub = subscribeProveedores(setProveedores);
    return unsub;
  }, []);

  const resetForm = () => {
    setNombre("");
    setDescripcion("");
    setCosto(0);
    setProveedorOtro("");
    setTransporteOtro("");
    setNumeroFactura("");
    setMontoFactura(0);
    setNumeroRemito("");
    setMontoRemito(0);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const prov = proveedores.find((p) => p.id === proveedorSel);
      const proveedorNombre =
        proveedorSel === "otro" ? proveedorOtro.trim() : prov?.nombre ?? "";
      const fechaTs = new Date(fechaIngreso).getTime();

      const truckId = await createTruck({
        nombre: nombre.trim(),
        color,
        fechaIngreso: fechaTs,
        porcentajeGanancia: Number(porcentaje) || 0,
        costoCamion: Number(costo) || 0,
        // Guardamos el nombre para mostrar en la card; "otro" = texto libre.
        proveedor: proveedorSel === "otro" ? "otro" : proveedorNombre,
        proveedorOtro:
          proveedorSel === "otro" ? proveedorOtro.trim() : undefined,
        proveedorId: prov ? prov.id : undefined,
        transporte,
        transporteOtro:
          transporte === "otro" ? transporteOtro.trim() : undefined,
        descripcion: descripcion.trim(),
        numeroFactura: numeroFactura.trim() || undefined,
        numeroRemito: numeroRemito.trim() || undefined,
      });

      // Si hay proveedor real vinculado, generamos las compras (deudas).
      if (prov) {
        const base = {
          proveedorId: prov.id,
          proveedorNombre: prov.nombre,
          fecha: fechaTs,
          camionId: truckId,
          camionNombre: nombre.trim(),
          createdBy: user?.uid,
        };
        if (numeroFactura.trim() && Number(montoFactura) > 0) {
          await createPurchase({
            ...base,
            modalidad: "A",
            numero: numeroFactura.trim(),
            monto: Number(montoFactura),
          });
        }
        if (numeroRemito.trim() && Number(montoRemito) > 0) {
          await createPurchase({
            ...base,
            modalidad: "B",
            numero: numeroRemito.trim(),
            monto: Number(montoRemito),
          });
        }
      }

      resetForm();
    } catch (e) {
      console.error(e);
      setError("No se pudo crear el camión.");
    } finally {
      setBusy(false);
    }
  };

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
    <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
      {/* === Form crear camión === */}
      <section className="rounded-2xl border border-brand-border bg-surface p-5">
        <h2 className="font-serif text-xl text-brand-dark">Nuevo camión</h2>
        <p className="mt-1 text-xs text-brand-dark/55">
          Al crear este camión, el anterior se cierra automáticamente.
        </p>
        <form onSubmit={handleCreate} className="mt-4 grid gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-brand-dark/70">
              Nombre
            </span>
            <input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Camión #12"
              className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-brand-dark/70">
              Color de referencia
            </span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded-lg border border-brand-border"
              />
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full ring-2 transition ${
                      color === c
                        ? "ring-brand-dark scale-110"
                        : "ring-transparent hover:ring-brand-dark/30"
                    }`}
                    style={{ background: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>
          </label>

          {/* Proveedor dropdown (de la cuenta corriente) */}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-brand-dark/70">
              Proveedor
            </span>
            <select
              value={proveedorSel}
              onChange={(e) => setProveedorSel(e.target.value)}
              className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">— Sin proveedor —</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
              <option value="otro">Otro… (sin cuenta corriente)</option>
            </select>
            {proveedorSel === "otro" && (
              <input
                value={proveedorOtro}
                onChange={(e) => setProveedorOtro(e.target.value)}
                placeholder="Nombre del proveedor"
                className="mt-2 w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
              />
            )}
            <p className="mt-1 text-[10px] text-brand-dark/45">
              Los proveedores se administran en{" "}
              <span className="font-medium">Cuentas Ctes</span>. Si elegís uno,
              las compras de abajo se cargan a su cuenta.
            </p>
          </label>

          {/* Compra al proveedor (genera deuda en la cuenta corriente) */}
          {proveedorSel && proveedorSel !== "otro" && (
            <div className="rounded-lg border border-brand-border bg-primary-light/20 p-3">
              <p className="mb-2 text-xs font-semibold text-brand-dark">
                Compra al proveedor (deuda)
              </p>
              <div className="grid grid-cols-[1fr_120px] gap-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark/55">
                    Nº Factura (A · facturado)
                  </span>
                  <input
                    value={numeroFactura}
                    onChange={(e) => setNumeroFactura(e.target.value)}
                    placeholder="0001-00001234"
                    className="w-full rounded-lg border border-brand-border bg-white px-2 py-1.5 text-xs outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark/55">
                    Monto
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={montoFactura || ""}
                    onChange={(e) => setMontoFactura(Number(e.target.value))}
                    placeholder="0"
                    className="w-full rounded-lg border border-brand-border bg-white px-2 py-1.5 text-xs"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark/55">
                    Nº Remito (B · sin facturar)
                  </span>
                  <input
                    value={numeroRemito}
                    onChange={(e) => setNumeroRemito(e.target.value)}
                    placeholder="R-0001"
                    className="w-full rounded-lg border border-brand-border bg-white px-2 py-1.5 text-xs outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark/55">
                    Monto
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={montoRemito || ""}
                    onChange={(e) => setMontoRemito(Number(e.target.value))}
                    placeholder="0"
                    className="w-full rounded-lg border border-brand-border bg-white px-2 py-1.5 text-xs"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Transporte dropdown */}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-brand-dark/70">
              Transporte
            </span>
            <select
              value={transporte}
              onChange={(e) => setTransporte(e.target.value)}
              className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {TRANSPORTES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value="otro">Otro…</option>
            </select>
            {transporte === "otro" && (
              <input
                value={transporteOtro}
                onChange={(e) => setTransporteOtro(e.target.value)}
                placeholder="Nombre del transportista"
                className="mt-2 w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
              />
            )}
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-brand-dark/70">
              Fecha de ingreso
            </span>
            <input
              required
              type="date"
              value={fechaIngreso}
              onChange={(e) => setFechaIngreso(e.target.value)}
              className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-brand-dark/70">
                % Ganancia
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={porcentaje}
                onChange={(e) => setPorcentaje(Number(e.target.value))}
                className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-brand-dark/70">
                Costo (ARS)
              </span>
              <input
                type="number"
                min={0}
                step={1000}
                value={costo}
                onChange={(e) => setCosto(Number(e.target.value))}
                className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-brand-dark/70">
              Descripción (opcional)
            </span>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              placeholder="Notas adicionales del camión"
              className="w-full resize-none rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {busy ? "Creando…" : "Crear camión"}
          </button>
        </form>
      </section>

      {/* === Lista === */}
      <section>
        <h2 className="mb-3 font-serif text-xl text-brand-dark">
          Camiones registrados
        </h2>
        {loading ? (
          <p className="text-brand-dark/60">Cargando…</p>
        ) : trucks.length === 0 ? (
          <div className="rounded-2xl border border-brand-border bg-surface p-8 text-center text-brand-dark/60">
            Todavía no hay camiones. Creá el primero en el formulario.
          </div>
        ) : (
          <div className="space-y-3">
            {trucks.map((t) => (
              <TruckCard
                key={t.id}
                truck={t}
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
  onDelete,
}: {
  truck: Truck;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const activo = !truck.fechaCierre;
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
          <p className="font-semibold text-primary">
            {truck.porcentajeGanancia}% ganancia
          </p>
          {truck.costoCamion && truck.costoCamion > 0 && (
            <p className="text-xs text-brand-dark/55">
              Costo: {formatARS(truck.costoCamion)}
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

      {open && <CargoEditor truck={truck} />}
    </article>
  );
}

// ====== EDITOR DE CARGA (productos del catálogo + costo + precio óptimo) ======
function CargoEditor({ truck }: { truck: Truck }) {
  const productos = useProducts();
  const [items, setItems] = useState<TruckCargoItem[]>(truck.carga ?? []);

  // Form state
  const [productId, setProductId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cantidad, setCantidad] = useState(0);
  const [costo, setCosto] = useState(0);
  const [precioVentaOptimo, setPrecioVentaOptimo] = useState(0);
  const [busy, setBusy] = useState(false);

  // Productos del catálogo filtrados por búsqueda
  const productosFiltrados = useMemo<Product[]>(() => {
    if (!busqueda.trim()) return productos.slice(0, 30);
    const t = busqueda.toLowerCase();
    return productos
      .filter(
        (p: Product) =>
          p.nombre.toLowerCase().includes(t) ||
          (p.ean ?? "").includes(t)
      )
      .slice(0, 30);
  }, [productos, busqueda]);

  const productoSeleccionado = productos.find((p) => p.id === productId);

  const save = async (next: TruckCargoItem[]) => {
    setBusy(true);
    try {
      await updateTruckCargo(truck.id, next);
      setItems(next);
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar la carga.");
    } finally {
      setBusy(false);
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productoSeleccionado || cantidad <= 0 || costo <= 0) return;
    const next: TruckCargoItem[] = [
      ...items,
      {
        productId: productoSeleccionado.id,
        producto: productoSeleccionado.nombre,
        descripcion: descripcion.trim() || undefined,
        cantidadUnidades: Number(cantidad),
        costoUnitario: Number(costo),
        precioVentaOptimo: Number(precioVentaOptimo) || 0,
      },
    ];
    await save(next);
    // limpiar
    setProductId("");
    setBusqueda("");
    setDescripcion("");
    setCantidad(0);
    setCosto(0);
    setPrecioVentaOptimo(0);
  };

  const remove = async (idx: number) => {
    await save(items.filter((_, i) => i !== idx));
  };

  // Totales del cargo
  const totalUnidades = items.reduce((s, it) => s + it.cantidadUnidades, 0);
  const totalCosto = items.reduce(
    (s, it) => s + it.cantidadUnidades * (it.costoUnitario ?? 0),
    0
  );
  const totalVentaOptima = items.reduce(
    (s, it) => s + it.cantidadUnidades * (it.precioVentaOptimo ?? 0),
    0
  );

  return (
    <div className="border-t border-brand-border bg-primary-light/20 p-4">
      <p className="mb-3 text-[11px] text-brand-dark/60">
        💡 Seleccioná un producto del catálogo. El precio óptimo es{" "}
        <b>solo informativo</b> — no modifica el catálogo automáticamente. El
        precio público lo actualizás desde <code>/admin/productos</code> día a día.
      </p>

      {/* Lista actual */}
      {items.length > 0 ? (
        <div className="mb-3 overflow-x-auto rounded-lg border border-brand-border bg-surface">
          <table className="w-full text-xs">
            <thead className="bg-primary-light/50 text-[10px] uppercase text-primary">
              <tr>
                <th className="px-2 py-1.5 text-left">Producto</th>
                <th className="px-2 py-1.5 text-right">Cant.</th>
                <th className="px-2 py-1.5 text-right">Costo u.</th>
                <th className="px-2 py-1.5 text-right">Venta ópt.</th>
                <th className="px-2 py-1.5 text-right">Total costo</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-t border-brand-border first:border-t-0">
                  <td className="px-2 py-1.5">
                    <p className="font-medium text-brand-dark">{it.producto}</p>
                    {it.descripcion && (
                      <p className="text-[10px] text-brand-dark/55">
                        {it.descripcion}
                      </p>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold">
                    {it.cantidadUnidades}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {formatARS(it.costoUnitario ?? 0)}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {it.precioVentaOptimo
                      ? formatARS(it.precioVentaOptimo)
                      : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold text-rose-700">
                    {formatARS(it.cantidadUnidades * (it.costoUnitario ?? 0))}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      onClick={() => remove(i)}
                      className="text-rose-600 hover:opacity-70"
                      title="Quitar"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-brand-border bg-primary-light/30 font-bold">
                <td className="px-2 py-1.5 text-brand-dark">Totales</td>
                <td className="px-2 py-1.5 text-right">{totalUnidades}</td>
                <td className="px-2 py-1.5 text-right text-rose-700">—</td>
                <td className="px-2 py-1.5 text-right text-emerald-700">
                  {totalVentaOptima > 0 ? formatARS(totalVentaOptima) : "—"}
                </td>
                <td className="px-2 py-1.5 text-right text-rose-700">
                  {formatARS(totalCosto)}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mb-3 text-xs text-brand-dark/55">
          Todavía no agregaste productos a la carga.
        </p>
      )}

      {/* Form de agregar */}
      <form onSubmit={add} className="space-y-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {/* Búsqueda + Selector producto */}
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark/55">
              Producto del catálogo
            </label>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o EAN…"
              className="mb-1 w-full rounded-lg border border-brand-border bg-white px-2 py-1.5 text-xs outline-none focus:border-primary"
            />
            <select
              required
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full rounded-lg border border-brand-border bg-white px-2 py-1.5 text-xs outline-none focus:border-primary"
            >
              <option value="">— Seleccionar producto —</option>
              {productosFiltrados.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.marca}] {p.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark/55">
              Descripción / variante (opcional)
            </label>
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="ej: Lote junio, talle G, …"
              className="w-full rounded-lg border border-brand-border bg-white px-2 py-1.5 text-xs outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[100px_140px_140px_auto]">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark/55">
              Cantidad
            </label>
            <input
              required
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={cantidad || ""}
              onChange={(e) => setCantidad(Number(e.target.value))}
              placeholder="50"
              className="w-full rounded-lg border border-brand-border bg-white px-2 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-rose-700">
              Costo por unidad (ARS)
            </label>
            <input
              required
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={costo || ""}
              onChange={(e) => setCosto(Number(e.target.value))}
              placeholder="1000"
              className="w-full rounded-lg border border-rose-300 bg-white px-2 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Venta óptima (ARS)
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={precioVentaOptimo || ""}
              onChange={(e) => setPrecioVentaOptimo(Number(e.target.value))}
              placeholder="1500"
              className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5 text-xs"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !productId || cantidad <= 0 || costo <= 0}
            className="self-end rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {busy ? "…" : "+ Agregar al cargo"}
          </button>
        </div>
      </form>
    </div>
  );
}
