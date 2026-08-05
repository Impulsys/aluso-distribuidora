"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  subscribeFleteros,
  subscribeMovimientosFlete,
  createFletero,
  deleteFletero,
  registrarMovimientoFlete,
  deleteMovimientoFlete,
} from "@/lib/fletes";
import { saldosPorFletero, deudaTotalFletes } from "@/lib/fleteSaldo";
import { formatARS, formatDate, tsFromISO } from "@/lib/format";
import type { CamionFlete, Fletero, MovimientoFlete } from "@/lib/types";

function hoyISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
const num = (v: string) => Math.max(0, Number(v) || 0);
const inputCls =
  "w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary";
const labelCls =
  "mb-1 block text-[11px] font-bold uppercase tracking-wider text-brand-dark/55";

export default function FletesPage() {
  const { user } = useAuth();
  const [fleteros, setFleteros] = useState<Fletero[]>([]);
  const [movs, setMovs] = useState<MovimientoFlete[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => subscribeFleteros(setFleteros), []);
  useEffect(() => subscribeMovimientosFlete(setMovs), []);

  const saldos = useMemo(
    () => saldosPorFletero(fleteros, movs),
    [fleteros, movs]
  );
  const deudaTotal = useMemo(
    () => deudaTotalFletes(fleteros, movs),
    [fleteros, movs]
  );

  // ----- Alta de fletero -----
  const [nNombre, setNNombre] = useState("");
  const [nContacto, setNContacto] = useState("");
  const [nTelefono, setNTelefono] = useState("");
  const [nNotas, setNNotas] = useState("");
  const [nCamiones, setNCamiones] = useState<CamionFlete[]>([]);
  const [busy, setBusy] = useState(false);

  const addCamion = () =>
    setNCamiones((c) => [...c, { nombre: "" }]);
  const setCamion = (i: number, patch: Partial<CamionFlete>) =>
    setNCamiones((c) => c.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const rmCamion = (i: number) =>
    setNCamiones((c) => c.filter((_, k) => k !== i));

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nNombre.trim() || busy) return;
    setBusy(true);
    try {
      await createFletero({
        nombre: nNombre.trim(),
        contacto: nContacto.trim() || undefined,
        telefono: nTelefono.trim() || undefined,
        notas: nNotas.trim() || undefined,
        camiones: nCamiones
          .filter((c) => c.nombre.trim())
          .map((c) => ({ ...c, nombre: c.nombre.trim() })),
      });
      setNNombre("");
      setNContacto("");
      setNTelefono("");
      setNNotas("");
      setNCamiones([]);
    } catch {
      alert("No se pudo crear el fletero.");
    } finally {
      setBusy(false);
    }
  };

  const borrarFletero = async (f: Fletero) => {
    if (!confirm(`¿Eliminar al fletero "${f.nombre}"?`)) return;
    try {
      await deleteFletero(f.id);
    } catch (err) {
      alert(
        (err as Error).message === "FLETERO_CON_MOVIMIENTOS"
          ? "No se puede eliminar: tiene movimientos en su cuenta. Borrá primero los movimientos."
          : "No se pudo eliminar el fletero."
      );
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5">
        <h1 className="flex items-center gap-2 font-serif text-2xl font-medium text-brand-dark">
          <span className="text-3xl">🚛</span> Fletes
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-brand-dark/60">
          Los transportistas con los que trabajás. Cada fletero tiene su propia
          cuenta: los fletes que te cobra (cargos) y lo que le vas pagando. En
          Envíos podés elegir con qué flete sale cada pedido.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* ===== Alta de fletero ===== */}
        <form
          onSubmit={crear}
          className="h-fit rounded-2xl border border-brand-border bg-surface p-4"
        >
          <h2 className="mb-3 font-serif text-lg text-brand-dark">
            Agregar fletero
          </h2>
          <div className="space-y-2">
            <div>
              <label className={labelCls}>Nombre</label>
              <input
                required
                value={nNombre}
                onChange={(e) => setNNombre(e.target.value)}
                placeholder="Transporte García"
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Contacto</label>
                <input
                  value={nContacto}
                  onChange={(e) => setNContacto(e.target.value)}
                  placeholder="Referente"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Teléfono</label>
                <input
                  value={nTelefono}
                  onChange={(e) => setNTelefono(e.target.value)}
                  placeholder="Tel"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Camiones del fletero (medidas) */}
            <div className="rounded-lg border border-brand-border bg-primary-light/15 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">
                  Camiones (medidas en cm)
                </p>
                <button
                  type="button"
                  onClick={addCamion}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  ＋ Agregar
                </button>
              </div>
              {nCamiones.length === 0 ? (
                <p className="text-[11px] text-brand-dark/45">
                  Opcional. Sirve para saber qué entra en cada camión.
                </p>
              ) : (
                <div className="space-y-2">
                  {nCamiones.map((c, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-brand-border bg-white p-2"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <input
                          value={c.nombre}
                          onChange={(e) => setCamion(i, { nombre: e.target.value })}
                          placeholder="Nombre (Chico, Chasis…)"
                          className="flex-1 rounded border border-brand-border px-2 py-1 text-xs outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => rmCamion(i)}
                          className="text-xs text-rose-600 hover:underline"
                        >
                          quitar
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {(
                          [
                            ["altoCm", "Alto"],
                            ["anchoCm", "Ancho"],
                            ["largoCm", "Largo"],
                            ["capacidadKg", "Kg"],
                          ] as const
                        ).map(([k, lbl]) => (
                          <input
                            key={k}
                            type="number"
                            min={0}
                            step="any"
                            value={(c[k] as number) || ""}
                            onChange={(e) =>
                              setCamion(i, { [k]: num(e.target.value) })
                            }
                            placeholder={lbl}
                            title={lbl}
                            className="w-full rounded border border-brand-border px-1.5 py-1 text-xs outline-none focus:border-primary"
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className={labelCls}>Notas (tarifa, zona…)</label>
              <input
                value={nNotas}
                onChange={(e) => setNNotas(e.target.value)}
                placeholder="Opcional"
                className={inputCls}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="mt-3 w-full rounded-lg bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {busy ? "Guardando…" : "Agregar fletero"}
          </button>
        </form>

        {/* ===== Cuentas por fletero ===== */}
        <div>
          <div className="mb-3 flex items-center justify-between rounded-2xl border border-brand-border bg-surface px-4 py-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-brand-dark/50">
                Deuda total con fletes
              </p>
              <p className="font-serif text-2xl font-medium text-primary">
                {deudaTotal > 0 ? formatARS(deudaTotal) : "Al día"}
              </p>
            </div>
            <p className="text-xs text-brand-dark/50">
              {fleteros.length} fletero{fleteros.length === 1 ? "" : "s"}
            </p>
          </div>

          {saldos.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-brand-border bg-surface p-8 text-center text-sm text-brand-dark/55">
              Todavía no cargaste fleteros. Agregá el primero a la izquierda.
            </p>
          ) : (
            <div className="space-y-2">
              {saldos.map((s) => {
                const f = fleteros.find((x) => x.id === s.fleteroId)!;
                const isOpen = abierto === s.fleteroId;
                return (
                  <article
                    key={s.fleteroId}
                    className="overflow-hidden rounded-2xl border border-brand-border bg-surface shadow-sm"
                  >
                    <button
                      onClick={() => setAbierto(isOpen ? null : s.fleteroId)}
                      className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-primary-light/30"
                    >
                      <span
                        className={`text-brand-dark/40 transition ${isOpen ? "rotate-90" : ""}`}
                      >
                        ▶
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-brand-dark">
                          {f.nombre}
                        </p>
                        <p className="text-xs text-brand-dark/55">
                          {f.camiones && f.camiones.length > 0
                            ? `${f.camiones.length} camión${f.camiones.length === 1 ? "" : "es"}`
                            : "sin camiones cargados"}
                          {s.movimientos > 0 ? ` · ${s.movimientos} mov.` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-serif text-lg font-medium ${
                            s.saldo > 0.01
                              ? "text-primary"
                              : s.saldo < -0.01
                              ? "text-emerald-600"
                              : "text-brand-dark/50"
                          }`}
                        >
                          {s.saldo > 0.01
                            ? formatARS(s.saldo)
                            : s.saldo < -0.01
                            ? `${formatARS(s.saldo)} a favor`
                            : "al día"}
                        </p>
                        <p className="text-[11px] text-brand-dark/45">
                          le debés
                        </p>
                      </div>
                    </button>

                    {isOpen && (
                      <FleteroDetalle
                        fletero={f}
                        movs={movs.filter((m) => m.fleteroId === f.id)}
                        uid={user?.uid}
                        onBorrarFletero={() => borrarFletero(f)}
                      />
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Detalle de un fletero: camiones, movimientos y alta de cargo/pago. */
function FleteroDetalle({
  fletero,
  movs,
  uid,
  onBorrarFletero,
}: {
  fletero: Fletero;
  movs: MovimientoFlete[];
  uid?: string;
  onBorrarFletero: () => void;
}) {
  const [tipo, setTipo] = useState<"cargo" | "pago">("cargo");
  const [monto, setMonto] = useState(0);
  const [fecha, setFecha] = useState(hoyISO());
  const [detalle, setDetalle] = useState("");
  const [busy, setBusy] = useState(false);

  const registrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (monto <= 0 || busy) return;
    setBusy(true);
    try {
      await registrarMovimientoFlete({
        fleteroId: fletero.id,
        tipo,
        monto: Number(monto),
        fecha: tsFromISO(fecha),
        detalle: detalle.trim() || undefined,
        createdBy: uid,
      });
      setMonto(0);
      setDetalle("");
    } catch {
      alert("No se pudo registrar el movimiento.");
    } finally {
      setBusy(false);
    }
  };

  const borrarMov = async (id: string) => {
    if (!confirm("¿Eliminar este movimiento?")) return;
    try {
      await deleteMovimientoFlete(id);
    } catch {
      alert("No se pudo eliminar.");
    }
  };

  return (
    <div className="border-t border-brand-border bg-primary-light/15 p-4">
      {/* Camiones */}
      {fletero.camiones && fletero.camiones.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {fletero.camiones.map((c, i) => (
            <span
              key={i}
              className="rounded-lg border border-brand-border bg-white px-2.5 py-1 text-xs text-brand-dark/70"
            >
              🚛 <b className="text-brand-dark">{c.nombre}</b>
              {(c.altoCm || c.anchoCm || c.largoCm) && (
                <>
                  {" "}
                  · {c.altoCm ?? "?"}×{c.anchoCm ?? "?"}×{c.largoCm ?? "?"} cm
                </>
              )}
              {c.capacidadKg ? ` · ${c.capacidadKg} kg` : ""}
            </span>
          ))}
        </div>
      )}
      {(fletero.contacto || fletero.telefono || fletero.notas) && (
        <p className="mb-3 text-xs text-brand-dark/60">
          {[fletero.contacto, fletero.telefono, fletero.notas]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      {/* Alta de movimiento */}
      <form
        onSubmit={registrar}
        className="mb-3 rounded-xl border border-brand-border bg-surface p-3"
      >
        <div className="mb-2 inline-flex rounded-lg border border-brand-border p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setTipo("cargo")}
            className={`rounded-md px-3 py-1 font-semibold transition ${
              tipo === "cargo" ? "bg-primary text-white" : "text-brand-dark/60"
            }`}
          >
            Cargo (te cobró)
          </button>
          <button
            type="button"
            onClick={() => setTipo("pago")}
            className={`rounded-md px-3 py-1 font-semibold transition ${
              tipo === "pago" ? "bg-emerald-600 text-white" : "text-brand-dark/60"
            }`}
          >
            Pago (le pagaste)
          </button>
        </div>
        <div className="grid grid-cols-[1fr_130px] gap-2">
          <div>
            <label className={labelCls}>Monto</label>
            <input
              type="number"
              min={1}
              step="any"
              value={monto || ""}
              onChange={(e) => setMonto(num(e.target.value))}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <div className="mt-2">
          <label className={labelCls}>Detalle (opcional)</label>
          <input
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            placeholder={tipo === "cargo" ? "Flete del 12/08…" : "Transferencia…"}
            className={inputCls}
          />
        </div>
        <button
          type="submit"
          disabled={busy || monto <= 0}
          className={`mt-3 w-full rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
            tipo === "cargo"
              ? "bg-primary hover:bg-primary-dark"
              : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {busy
            ? "Registrando…"
            : tipo === "cargo"
            ? "Registrar cargo"
            : "Registrar pago"}
        </button>
      </form>

      {/* Historial de movimientos */}
      {movs.length === 0 ? (
        <p className="text-center text-xs text-brand-dark/45">
          Sin movimientos todavía.
        </p>
      ) : (
        <ul className="space-y-1">
          {movs.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2 rounded-lg border border-brand-border bg-surface px-3 py-1.5 text-sm"
            >
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                  m.tipo === "cargo"
                    ? "bg-sky-100 text-sky-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {m.tipo === "cargo" ? "Cargo" : "Pago"}
              </span>
              <span className="text-xs text-brand-dark/55">
                {formatDate(m.fecha)}
              </span>
              {m.detalle && (
                <span className="min-w-0 flex-1 truncate text-xs text-brand-dark/70">
                  {m.detalle}
                </span>
              )}
              <span
                className={`ml-auto font-semibold tabular-nums ${
                  m.tipo === "cargo" ? "text-brand-dark" : "text-emerald-700"
                }`}
              >
                {m.tipo === "cargo" ? "" : "−"}
                {formatARS(m.monto)}
              </span>
              <button
                onClick={() => borrarMov(m.id)}
                className="text-brand-dark/35 hover:text-rose-600"
                title="Eliminar"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 text-right">
        <button
          onClick={onBorrarFletero}
          className="text-xs font-medium text-rose-700 hover:underline"
        >
          Eliminar fletero
        </button>
      </div>
    </div>
  );
}
