"use client";

import { useEffect, useState } from "react";
import { createTruck, deleteTruck, subscribeTrucks } from "@/lib/trucks";
import { formatDate } from "@/lib/format";
import type { Truck } from "@/lib/types";

// Paleta sugerida — clicable para elegir rápido
const PRESET_COLORS = [
  "#EF4444", // rojo
  "#F97316", // naranja
  "#EAB308", // amarillo
  "#10B981", // verde
  "#06B6D4", // cyan
  "#3B82F6", // azul
  "#8B5CF6", // violeta
  "#EC4899", // rosa
  "#A16207", // marrón
  "#475569", // gris
];

function todayISO() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t.toISOString().slice(0, 10);
}

export default function AdminCamionesPage() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulario
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[5]);
  const [fechaIngreso, setFechaIngreso] = useState(todayISO());
  const [porcentaje, setPorcentaje] = useState(35);
  const [costo, setCosto] = useState(0);
  const [descripcion, setDescripcion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeTrucks((t) => {
      setTrucks(t);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createTruck({
        nombre: nombre.trim(),
        color,
        fechaIngreso: new Date(fechaIngreso).getTime(),
        porcentajeGanancia: Number(porcentaje) || 0,
        costoCamion: Number(costo) || 0,
        descripcion: descripcion.trim(),
      });
      // limpiar
      setNombre("");
      setDescripcion("");
      setCosto(0);
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
              placeholder="Proveedor, contenido, etc."
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

      {/* === Lista de camiones === */}
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
          <div className="space-y-2">
            {trucks.map((t) => {
              const activo = !t.fechaCierre;
              return (
                <article
                  key={t.id}
                  className="overflow-hidden rounded-xl border border-brand-border bg-surface transition hover:shadow-md"
                >
                  <div
                    className="h-2 w-full"
                    style={{ background: t.color }}
                    aria-hidden
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="grid h-10 w-10 place-items-center rounded-full text-xl text-white shadow"
                        style={{ background: t.color }}
                      >
                        🚚
                      </div>
                      <div>
                        <p className="font-semibold text-brand-dark">
                          {t.nombre}
                          {activo && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                              Activo
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-brand-dark/55">
                          Ingreso: {formatDate(t.fechaIngreso)}
                          {t.fechaCierre && (
                            <> · Cierre: {formatDate(t.fechaCierre)}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold text-primary">
                        {t.porcentajeGanancia}% ganancia
                      </p>
                      {t.costoCamion && t.costoCamion > 0 && (
                        <p className="text-xs text-brand-dark/55">
                          Costo: ${t.costoCamion.toLocaleString("es-AR")}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(t.id, t.nombre)}
                      className="text-xs text-rose-700 hover:underline"
                    >
                      Eliminar
                    </button>
                  </div>
                  {t.descripcion && (
                    <p className="border-t border-brand-border bg-primary-light/30 px-4 py-2 text-xs italic text-brand-dark/70">
                      {t.descripcion}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
