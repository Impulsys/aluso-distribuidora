"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  armarPallet,
  COLORES_PEDIDO,
  PALLET_ESTANDAR,
  type BultoAColocar,
} from "@/lib/pallet";
import { LOGISTICA_POR_EAN, medidasBulto } from "@/data/logistica";
import { useProducts } from "@/hooks/useProducts";
import type { Envio, Remito } from "@/lib/types";

const PalletViewer3D = dynamic(() => import("@/components/PalletViewer3D"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[420px] place-items-center text-sm text-brand-dark/50">
      Cargando vista 3D…
    </div>
  ),
});

const esGranel = (r: Remito) => r.modoDespacho === "granel";

/**
 * Modal reutilizable del armado del pallet en 3D. Se usa en Envíos (admin) y en
 * la vista del Depósito. Arma los bultos del envío y los muestra apilados.
 */
export default function Pallet3DModal({
  envio,
  rs,
  onClose,
}: {
  envio: Envio;
  rs: Remito[];
  onClose: () => void;
}) {
  const productos = useProducts();
  const eanPorId = useMemo(() => {
    const m = new Map<string, string>();
    productos.forEach((p) => m.set(p.id, p.ean ?? p.id));
    return m;
  }, [productos]);

  const [palletActivo, setPalletActivo] = useState(0);
  const rsPallet = useMemo(() => rs.filter((r) => !esGranel(r)), [rs]);
  const rsGranel = useMemo(() => rs.filter(esGranel), [rs]);

  const bultosDeEnvio = (lista: Remito[], capLinea = 120): BultoAColocar[] => {
    const bultos: BultoAColocar[] = [];
    lista.forEach((r, i) => {
      const color = COLORES_PEDIDO[i % COLORES_PEDIDO.length];
      const etiqueta = `${r.numero} · ${r.clienteNombre || "s/cliente"}`;
      r.items.forEach((it) => {
        const ean = eanPorId.get(it.productId) ?? it.productId;
        const paq =
          it.paqPorBulto && it.paqPorBulto > 0
            ? it.paqPorBulto
            : LOGISTICA_POR_EAN[ean]?.paqPorBulto;
        const d = LOGISTICA_POR_EAN[ean];
        if (!d || !paq) return;
        const nBultos = Math.max(1, Math.ceil(it.cantidad / paq));
        const med = medidasBulto(d);
        for (let k = 0; k < Math.min(nBultos, capLinea); k++) {
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

  const armado = useMemo(
    () =>
      armarPallet(bultosDeEnvio(rsPallet), PALLET_ESTANDAR, {
        separarPedidos: true,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rsPallet, eanPorId]
  );

  const palletsInfo = useMemo(() => {
    const info: { etiqueta: string; color: string }[] = [];
    for (let i = 0; i < armado.pallets; i++) {
      const caja = armado.cajas.find((c) => c.pallet === i);
      info.push({
        etiqueta: caja?.etiqueta ?? `Pallet ${i + 1}`,
        color: caja?.color ?? "#94a3b8",
      });
    }
    return info;
  }, [armado]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl bg-surface p-4 shadow-xl">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-serif text-lg text-brand-dark">
            Armado del pallet · {rs.length} pedido{rs.length === 1 ? "" : "s"}
          </h3>
          <button
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm ring-1 ring-brand-border hover:bg-primary-light"
          >
            Cerrar
          </button>
        </div>

        {rsPallet.length > 0 ? (
          <>
            {palletsInfo.length > 1 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {palletsInfo.map((info, i) => (
                  <button
                    key={i}
                    onClick={() => setPalletActivo(i)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                      palletActivo === i
                        ? "bg-primary text-white"
                        : "bg-primary-light text-primary"
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ background: info.color }}
                    />
                    Pallet {i + 1}
                  </button>
                ))}
              </div>
            )}
            <p className="mb-2 text-xs text-brand-dark">
              Mostrando <b>Pallet {palletActivo + 1}</b> —{" "}
              {palletsInfo[palletActivo]?.etiqueta}
            </p>

            <PalletViewer3D
              cajas={armado.cajas}
              pallet={PALLET_ESTANDAR}
              palletIndex={palletActivo}
            />

            <div className="mt-3 flex flex-wrap gap-2">
              {rsPallet.map((r, i) => (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-1.5 text-xs text-brand-dark/70"
                >
                  <span
                    className="h-3 w-3 rounded-sm"
                    style={{ background: COLORES_PEDIDO[i % COLORES_PEDIDO.length] }}
                  />
                  {r.numero} · {r.clienteNombre || "s/cliente"}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="py-8 text-center text-sm text-brand-dark/55">
            Este envío no tiene pedidos palletizados para mostrar en 3D.
          </p>
        )}

        {rsGranel.length > 0 && (
          <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-3">
            <p className="text-xs font-bold text-orange-800">
              🧺 A granel (sin pallet)
            </p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {rsGranel.map((r) => (
                <span key={r.id} className="text-xs text-orange-900/80">
                  {r.numero} · {r.clienteNombre || "s/cliente"}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
