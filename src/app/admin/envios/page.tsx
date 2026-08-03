"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeRemitosRange } from "@/lib/ventas";
import {
  subscribeEnvios,
  crearEnvio,
  cambiarEstadoEnvio,
  borrarEnvio,
} from "@/lib/envios";
import { volumenDeEnvio, type ItemVolumen } from "@/lib/logistica";
import { LOGISTICA_POR_EAN } from "@/data/logistica";
import { useProducts } from "@/hooks/useProducts";
import { proformaHTML } from "@/lib/remito-print";
import { abrirA4 } from "@/lib/a4";
import { useAuth } from "@/context/AuthContext";
import { formatDate, tsFromISO } from "@/lib/format";
import {
  ESTADO_LOGISTICA_LABELS,
  type Remito,
  type Envio,
  type EstadoLogistica,
} from "@/lib/types";

const TRANSPORTES = ["Retira en depósito", "Flete propio", "Otro flete"];

function hoyISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

const ESTADO_COLOR: Record<EstadoLogistica, string> = {
  pendiente: "bg-slate-100 text-slate-700",
  asignado: "bg-sky-100 text-sky-800",
  preparacion: "bg-amber-100 text-amber-800",
  listo: "bg-violet-100 text-violet-800",
  entregado: "bg-emerald-100 text-emerald-800",
};

const FLUJO: EstadoLogistica[] = ["asignado", "preparacion", "listo", "entregado"];

export default function EnviosPage() {
  const { user } = useAuth();
  const productos = useProducts();
  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [envios, setEnvios] = useState<Envio[]>([]);
  // Los remitos se leen de un rango amplio (últimos 60 días) para tener los
  // pendientes de despacho aunque la venta sea de días atrás.
  useEffect(() => {
    const fin = Date.now() + 86_400_000;
    const ini = fin - 60 * 86_400_000;
    return subscribeRemitosRange(ini, fin, setRemitos);
  }, []);
  useEffect(() => subscribeEnvios(setEnvios), []);

  // EAN por productId, para buscar los datos de paquetería.
  const eanPorId = useMemo(() => {
    const m = new Map<string, string>();
    productos.forEach((p) => p.ean && m.set(p.id, p.ean));
    return m;
  }, [productos]);

  const volumenDeRemito = (r: Remito) => {
    const items: ItemVolumen[] = r.items.map((it) => {
      const ean = eanPorId.get(it.productId) ?? it.productId;
      const d = LOGISTICA_POR_EAN[ean];
      return {
        ean,
        cantidad: it.cantidad,
        m3Bulto: d?.m3Bulto ?? 0,
        paqPorBulto: d?.paqPorBulto ?? 0,
      };
    });
    return volumenDeEnvio(items);
  };

  const remitoPorId = useMemo(() => {
    const m = new Map<string, Remito>();
    remitos.forEach((r) => m.set(r.id, r));
    return m;
  }, [remitos]);

  // Pendientes de despacho: remitos no anulados, sin envío asignado.
  const pendientes = useMemo(
    () => remitos.filter((r) => !r.anulado && !r.envioId),
    [remitos]
  );

  // --- Armado de un envío nuevo ---
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [fecha, setFecha] = useState(hoyISO());
  const [transporte, setTransporte] = useState(TRANSPORTES[0]);
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const volumenSel = useMemo(() => {
    const items: ItemVolumen[] = [];
    sel.forEach((id) => {
      const r = remitoPorId.get(id);
      r?.items.forEach((it) => {
        const ean = eanPorId.get(it.productId) ?? it.productId;
        const d = LOGISTICA_POR_EAN[ean];
        items.push({
          ean,
          cantidad: it.cantidad,
          m3Bulto: d?.m3Bulto ?? 0,
          paqPorBulto: d?.paqPorBulto ?? 0,
        });
      });
    });
    return volumenDeEnvio(items);
  }, [sel, remitoPorId, eanPorId]);

  const programar = async () => {
    if (sel.size === 0) return;
    setBusy(true);
    try {
      await crearEnvio({
        fecha: tsFromISO(fecha),
        transporte,
        remitoIds: [...sel],
        observaciones: obs.trim() || undefined,
        createdBy: user?.uid,
      });
      setSel(new Set());
      setObs("");
    } catch (e) {
      console.error(e);
      alert("No se pudo programar el envío.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 font-serif text-2xl font-medium text-brand-dark">
          <span className="text-3xl">🚚</span> Envíos
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-brand-dark/60">
          Programá las entregas: agrupá pedidos en un envío, con su flete y día.
          El volumen y los pallets se calculan con las medidas de cada producto.
        </p>
      </div>

      {/* ===== Armar un envío ===== */}
      <section className="mb-8 rounded-2xl border border-brand-border bg-surface p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-primary">
          Pendientes de despacho
        </h2>
        {pendientes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-brand-border p-6 text-center text-sm text-brand-dark/55">
            No hay pedidos pendientes de despachar.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {pendientes.map((r) => {
                const v = volumenDeRemito(r);
                const activo = sel.has(r.id);
                return (
                  <label
                    key={r.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                      activo
                        ? "border-primary bg-primary-light/25"
                        : "border-brand-border bg-surface hover:border-primary/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={activo}
                      onChange={() => toggle(r.id)}
                      className="h-4 w-4"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-brand-dark">
                        {r.numero} · {r.clienteNombre || "Consumidor final"}
                      </p>
                      <p className="text-xs text-brand-dark/55">
                        {formatDate(r.fecha)} · {r.items.length} producto
                        {r.items.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs">
                      <p className="font-semibold text-brand-dark">
                        {v.m3} m³ · {v.bultos} bultos
                      </p>
                      <p className="text-brand-dark/50">
                        ~{v.pallets} pallet{v.pallets === 1 ? "" : "s"}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            {sel.size > 0 && (
              <div className="mt-4 rounded-xl border border-primary/30 bg-primary-light/20 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-primary">
                    {sel.size} pedido{sel.size === 1 ? "" : "s"} seleccionado
                    {sel.size === 1 ? "" : "s"}
                  </p>
                  <p className="text-sm text-brand-dark">
                    Total: <b>{volumenSel.m3} m³</b> · {volumenSel.bultos} bultos ·{" "}
                    <b>~{volumenSel.pallets} pallet{volumenSel.pallets === 1 ? "" : "s"}</b>
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-xs font-semibold uppercase text-brand-dark/55">
                    Día de entrega
                    <input
                      type="date"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-brand-border bg-surface px-3 py-2 text-sm normal-case outline-none focus:border-primary"
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase text-brand-dark/55">
                    Flete / retiro
                    <select
                      value={transporte}
                      onChange={(e) => setTransporte(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-brand-border bg-surface px-3 py-2 text-sm normal-case outline-none focus:border-primary"
                    >
                      {TRANSPORTES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold uppercase text-brand-dark/55">
                    Observaciones
                    <input
                      value={obs}
                      onChange={(e) => setObs(e.target.value)}
                      placeholder="Opcional"
                      className="mt-1 w-full rounded-lg border border-brand-border bg-surface px-3 py-2 text-sm normal-case outline-none focus:border-primary"
                    />
                  </label>
                </div>
                <button
                  onClick={programar}
                  disabled={busy}
                  className="mt-3 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
                >
                  {busy ? "Programando…" : "🚚 Programar envío"}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* ===== Envíos programados ===== */}
      <section>
        <h2 className="mb-3 text-sm font-bold text-primary">
          Envíos programados
        </h2>
        {envios.length === 0 ? (
          <p className="rounded-xl border border-dashed border-brand-border p-6 text-center text-sm text-brand-dark/55">
            Todavía no hay envíos programados.
          </p>
        ) : (
          <div className="space-y-3">
            {envios.map((e) => {
              const rs = e.remitoIds
                .map((id) => remitoPorId.get(id))
                .filter(Boolean) as Remito[];
              const items: ItemVolumen[] = [];
              rs.forEach((r) =>
                r.items.forEach((it) => {
                  const ean = eanPorId.get(it.productId) ?? it.productId;
                  const d = LOGISTICA_POR_EAN[ean];
                  items.push({
                    ean,
                    cantidad: it.cantidad,
                    m3Bulto: d?.m3Bulto ?? 0,
                    paqPorBulto: d?.paqPorBulto ?? 0,
                  });
                })
              );
              const v = volumenDeEnvio(items);
              const idxEstado = FLUJO.indexOf(e.estado);
              const proximo = FLUJO[idxEstado + 1];
              return (
                <article
                  key={e.id}
                  className="rounded-2xl border border-brand-border bg-surface p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-brand-dark">
                        {formatDate(e.fecha)} · {e.transporte}
                      </p>
                      <p className="text-xs text-brand-dark/55">
                        {rs.length} pedido{rs.length === 1 ? "" : "s"} · {v.m3} m³
                        · {v.bultos} bultos · ~{v.pallets} pallet
                        {v.pallets === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${ESTADO_COLOR[e.estado]}`}
                    >
                      {ESTADO_LOGISTICA_LABELS[e.estado]}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 border-t border-brand-border pt-3">
                    {rs.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => abrirA4(proformaHTML(r))}
                        title="Imprimir proforma sin precio (para armar)"
                        className="rounded-lg bg-primary-light px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary hover:text-white"
                      >
                        🖨️ {r.numero} · {r.clienteNombre || "s/cliente"}
                      </button>
                    ))}
                  </div>

                  {e.observaciones && (
                    <p className="mt-2 text-xs text-brand-dark/60">
                      📝 {e.observaciones}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {proximo && (
                      <button
                        onClick={() => cambiarEstadoEnvio(e, proximo)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Marcar “{ESTADO_LOGISTICA_LABELS[proximo]}” →
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm("¿Borrar el envío? Los pedidos vuelven a pendientes."))
                          borrarEnvio(e);
                      }}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50"
                    >
                      Borrar
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
