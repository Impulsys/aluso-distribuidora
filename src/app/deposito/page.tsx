"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeRemitos } from "@/lib/ventas";
import { subscribeEnvios } from "@/lib/envios";
import {
  hojaArmadoHTML,
  proformasControlHTML,
  identificacionPalletHTML,
  constanciaTransportistaHTML,
  protocoloPreparacionHTML,
  proformaHTML,
  remitosTransporteEnvioHTML,
} from "@/lib/remito-print";
import { abrirA4 } from "@/lib/a4";
import { formatDate } from "@/lib/format";
import Pallet3DModal from "@/components/Pallet3DModal";
import { ESTADO_LOGISTICA_LABELS, type Remito, type Envio } from "@/lib/types";

const esRetiro = (t: string) => t.toLowerCase().includes("retir");

/**
 * Vista del DEPÓSITO: solo lo necesario para armar y despachar, SIN precios.
 * - Envíos programados con sus documentos de armado (proformas, identificación
 *   de pallets, constancia, hoja de armado) — todos sin valorizar.
 * - Pendientes de despacho: remitos que todavía no entraron en un envío; se
 *   pueden VER como orden de armado (sin precios).
 */
export default function DepositoPage() {
  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [pallet3d, setPallet3d] = useState<{ envio: Envio; rs: Remito[] } | null>(
    null
  );

  useEffect(() => subscribeRemitos(setRemitos), []);
  useEffect(() => subscribeEnvios(setEnvios), []);

  const remitoPorId = useMemo(() => {
    const m = new Map<string, Remito>();
    remitos.forEach((r) => m.set(r.id, r));
    return m;
  }, [remitos]);

  // Pendientes = remitos no anulados que NO están en ningún envío programado.
  const enEnvio = useMemo(() => {
    const s = new Set<string>();
    envios.forEach((e) => e.remitoIds.forEach((id) => s.add(id)));
    return s;
  }, [envios]);

  const pendientes = useMemo(
    () =>
      remitos
        .filter((r) => !r.anulado && !enEnvio.has(r.id))
        .sort((a, b) => b.fecha - a.fecha),
    [remitos, enEnvio]
  );

  return (
    <div className="space-y-8">
      {/* Protocolo general */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-border bg-surface p-4">
        <p className="text-sm text-brand-dark/70">
          Documentos de armado <b>sin precios</b>. El depósito no ve importes.
        </p>
        <button
          onClick={() => abrirA4(protocoloPreparacionHTML())}
          className="rounded-lg bg-primary-light px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary hover:text-white"
        >
          📋 Protocolo de armado
        </button>
      </div>

      {/* Envíos programados */}
      <section>
        <h2 className="mb-3 font-serif text-xl text-brand-dark">
          Envíos programados
        </h2>
        {envios.length === 0 ? (
          <p className="rounded-xl border border-dashed border-brand-border p-6 text-center text-sm text-brand-dark/55">
            No hay envíos programados.
          </p>
        ) : (
          <div className="space-y-3">
            {envios.map((e) => {
              const rs = e.remitoIds
                .map((id) => remitoPorId.get(id))
                .filter(Boolean) as Remito[];
              return (
                <article
                  key={e.id}
                  className="rounded-2xl border border-brand-border bg-surface p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-brand-dark">
                        {formatDate(e.fecha)}{" "}
                        <span className="ml-1 text-xs font-normal text-brand-dark/55">
                          {esRetiro(e.transporte)
                            ? "· Retira en depósito"
                            : `· ${e.transporte}`}
                        </span>
                      </p>
                      <p className="text-xs text-brand-dark/55">
                        {rs.length} pedido{rs.length === 1 ? "" : "s"}
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {rs.map((r) => (
                          <li key={r.id} className="text-xs text-brand-dark/75">
                            <span className="font-medium">{r.numero}</span> ·{" "}
                            {r.clienteNombre || "Consumidor final"}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      {ESTADO_LOGISTICA_LABELS[e.estado]}
                    </span>
                  </div>

                  <div className="mt-3 border-t border-brand-border pt-3">
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-dark/45">
                      Documentos para el depósito
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => abrirA4(remitosTransporteEnvioHTML(rs))}
                        title="Los remitos que se lleva el flete (sin precios, 2 copias c/u)"
                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        🚚 Remitos del transporte
                      </button>
                      <button
                        onClick={() => abrirA4(proformasControlHTML(rs))}
                        className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-white hover:bg-primary-dark"
                      >
                        🖨️ Proformas de control
                      </button>
                      <button
                        onClick={() => abrirA4(identificacionPalletHTML(e, rs))}
                        className="rounded-lg bg-primary-light px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary hover:text-white"
                      >
                        🏷️ Identificación de pallets
                      </button>
                      <button
                        onClick={() => abrirA4(constanciaTransportistaHTML(e, rs))}
                        className="rounded-lg bg-primary-light px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary hover:text-white"
                      >
                        📄 Constancia transportista (×2)
                      </button>
                      <button
                        onClick={() => abrirA4(hojaArmadoHTML(e, rs))}
                        className="rounded-lg bg-primary-light px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary hover:text-white"
                      >
                        🧾 Hoja de armado
                      </button>
                      <button
                        onClick={() => setPallet3d({ envio: e, rs })}
                        className="rounded-lg bg-primary-light px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary hover:text-white"
                      >
                        🧊 Ver armado 3D
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Pendientes de despacho */}
      <section>
        <h2 className="mb-3 font-serif text-xl text-brand-dark">
          Pendientes de despacho
        </h2>
        {pendientes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-brand-border p-6 text-center text-sm text-brand-dark/55">
            No hay remitos pendientes.
          </p>
        ) : (
          <ul className="divide-y divide-brand-border overflow-hidden rounded-xl border border-brand-border bg-surface">
            {pendientes.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
              >
                <div className="flex-1">
                  <span className="font-medium text-brand-dark">
                    {r.numero}
                  </span>{" "}
                  <span className="text-brand-dark/55">
                    · {r.clienteNombre || "Consumidor final"} ·{" "}
                    {formatDate(r.fecha)}
                  </span>
                </div>
                <button
                  onClick={() => abrirA4(proformaHTML(r))}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark"
                >
                  👁️ Orden de armado (sin precios)
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pallet3d && (
        <Pallet3DModal
          envio={pallet3d.envio}
          rs={pallet3d.rs}
          onClose={() => setPallet3d(null)}
        />
      )}
    </div>
  );
}
