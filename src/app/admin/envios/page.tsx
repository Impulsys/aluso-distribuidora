"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { subscribeRemitosRange } from "@/lib/ventas";
import {
  armarPallet,
  COLORES_PEDIDO,
  PALLET_ESTANDAR,
  type BultoAColocar,
} from "@/lib/pallet";
import { medidasBulto } from "@/data/logistica";

// El visor 3D usa WebGL (window), así que se carga solo en el cliente.
const PalletViewer3D = dynamic(() => import("@/components/PalletViewer3D"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[420px] place-items-center text-sm text-brand-dark/50">
      Cargando vista 3D…
    </div>
  ),
});
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

// Envío de EJEMPLO para mostrar el armado 3D en funcionamiento SIN cargar datos
// reales (no escribe nada en la base). Usa EANs con medidas exactas de la
// planilla, con productId = ean para que resuelva la paquetería igual que una
// venta real. Tres pedidos de distintos rubros → tres colores en el pallet.
const EJEMPLO_PEDIDOS: {
  numero: string;
  cliente: string;
  items: { ean: string; cantidad: number }[];
}[] = [
  {
    numero: "R-000101",
    cliente: "Kiosco La Esquina",
    items: [
      { ean: "7790940003034", cantidad: 200 }, // algodón — bultos chatos
      { ean: "7790940216205", cantidad: 150 }, // toallas
    ],
  },
  {
    numero: "R-000102",
    cliente: "Almacén Doña Rosa",
    items: [
      { ean: "7790940003065", cantidad: 40 }, // algodón grande — cajas largas
      { ean: "7790940518057", cantidad: 60 }, // pañal — cajas anchas
    ],
  },
  {
    numero: "R-000103",
    cliente: "Farmacia del Pueblo",
    items: [
      { ean: "7790940000033", cantidad: 240 }, // gasa — muchos bultos
      { ean: "7790940515032", cantidad: 48 }, // cofias — cajas chicas
    ],
  },
];

function ejemploEnvio(): { envio: Envio; rs: Remito[] } {
  const rs = EJEMPLO_PEDIDOS.map((p, i) => ({
    id: `ejemplo-${i}`,
    numero: p.numero,
    clienteNombre: p.cliente,
    items: p.items.map((it) => ({ productId: it.ean, cantidad: it.cantidad })),
  })) as unknown as Remito[];
  const envio = {
    id: "ejemplo",
    fecha: Date.now(),
    transporte: "Ejemplo de demostración",
    estado: "asignado",
    remitoIds: rs.map((r) => r.id),
  } as unknown as Envio;
  return { envio, rs };
}

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

  // Arma la lista de bultos físicos de un envío para el optimizador 3D: expande
  // cada renglón (unidades → bultos) con las medidas de cada producto, y le da
  // un color a cada pedido.
  const bultosDeEnvio = (rs: Remito[]): BultoAColocar[] => {
    const bultos: BultoAColocar[] = [];
    rs.forEach((r, i) => {
      const color = COLORES_PEDIDO[i % COLORES_PEDIDO.length];
      const etiqueta = `${r.numero} · ${r.clienteNombre || "s/cliente"}`;
      r.items.forEach((it) => {
        const ean = eanPorId.get(it.productId) ?? it.productId;
        const d = LOGISTICA_POR_EAN[ean];
        if (!d) return;
        const nBultos = Math.max(1, Math.ceil(it.cantidad / (d.paqPorBulto || 1)));
        const med = medidasBulto(d);
        // Tope de seguridad para no renderizar miles de cajas.
        for (let k = 0; k < Math.min(nBultos, 120); k++) {
          bultos.push({
            pedidoId: r.id,
            etiqueta,
            color,
            alto: med.alto,
            ancho: med.ancho,
            prof: med.prof,
          });
        }
      });
    });
    return bultos;
  };

  // Modal del pallet 3D.
  const [pallet3d, setPallet3d] = useState<{
    envio: Envio;
    rs: Remito[];
  } | null>(null);
  const [palletActivo, setPalletActivo] = useState(0);
  const armado = useMemo(
    () => (pallet3d ? armarPallet(bultosDeEnvio(pallet3d.rs)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pallet3d]
  );

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
        <button
          onClick={() => {
            setPalletActivo(0);
            setPallet3d(ejemploEnvio());
          }}
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary-light/40 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white"
        >
          👁️ Ver ejemplo de armado 3D
          <span className="text-[11px] font-normal opacity-70">
            (demostración — no carga datos)
          </span>
        </button>
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
                    <button
                      onClick={() => {
                        setPalletActivo(0);
                        setPallet3d({ envio: e, rs });
                      }}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark"
                    >
                      🧊 Ver armado del pallet 3D
                    </button>
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

      {/* ===== Modal: armado del pallet en 3D ===== */}
      {pallet3d && armado && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPallet3d(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-surface p-5 shadow-2xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-xl text-brand-dark">
                  Armado del pallet
                </h3>
                <p className="text-xs text-brand-dark/55">
                  {formatDate(pallet3d.envio.fecha)} · {pallet3d.envio.transporte}{" "}
                  · {armado.cajas.length} bultos · {armado.pallets} pallet
                  {armado.pallets === 1 ? "" : "s"}
                </p>
              </div>
              <button
                onClick={() => setPallet3d(null)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-brand-dark/60 hover:bg-brand-border/30"
              >
                ✕ Cerrar
              </button>
            </div>

            {/* Selector de pallet (si hay más de uno) */}
            {armado.pallets > 1 && (
              <div className="mb-2 flex gap-1">
                {Array.from({ length: armado.pallets }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPalletActivo(i)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                      palletActivo === i
                        ? "bg-primary text-white"
                        : "bg-primary-light text-primary"
                    }`}
                  >
                    Pallet {i + 1}
                  </button>
                ))}
              </div>
            )}

            <PalletViewer3D
              cajas={armado.cajas}
              pallet={PALLET_ESTANDAR}
              palletIndex={palletActivo}
            />

            {/* Referencia de colores por pedido */}
            <div className="mt-3 flex flex-wrap gap-2">
              {pallet3d.rs.map((r, i) => (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-1.5 text-xs text-brand-dark/70"
                >
                  <span
                    className="h-3 w-3 rounded-sm"
                    style={{
                      background: COLORES_PEDIDO[i % COLORES_PEDIDO.length],
                    }}
                  />
                  {r.numero} · {r.clienteNombre || "s/cliente"}
                </span>
              ))}
            </div>

            <p className="mt-3 text-center text-[11px] text-brand-dark/45">
              Girá con el mouse o el dedo · rueda para acercar. Los pedidos van
              agrupados por color para descargarlos juntos.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
