/**
 * Configuración de PRECIOS de ALUSO, administrable desde el admin.
 *
 * Antes las listas y los porcentajes de descuento estaban hardcodeados en el
 * código (lib/precios). Ahora viven en Firestore (config/precios) y se editan
 * desde /admin/precios, sin tocar código. El motor de precios (lib/precios)
 * sigue siendo puro: recibe estos valores por parámetro.
 *
 * Lectura pública (el catálogo necesita las listas para mostrar precios), pero
 * son solo markups y porcentajes: NO hay costos acá.
 */

import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { LISTAS_PRECIO, CONFIG_PRECIOS_DEFAULT } from "./precios";
import { CONFIG_COMISIONES_DEFAULT } from "./comisiones";

export interface ListaPrecio {
  nombre: string;
  markup: number; // % sobre el costo
}

export interface PreciosConfig {
  /** Las listas de precios (nombre + markup). La de 28% es el distribuidor. */
  listas: ListaPrecio[];
  /** Descuentos por CONDICIÓN de la venta (se aplican en el remito). */
  descuentoEfectivoPct: number;
  descuentoRetiroPct: number;
  descuentoVolumenPct: number;
  volumenMinBultos: number;
  /** true = los % de descuento se suman; false = se aplican uno sobre otro. */
  acumulaSumando: boolean;
  /** Comisión por defecto de un vendedor (% de sus ventas). */
  comisionDefaultPct: number;
  /** % que cobra un reclutador sobre las ventas de cada reclutado (override). */
  overridePct: number;
}

export const DEFAULT_PRECIOS_CONFIG: PreciosConfig = {
  listas: LISTAS_PRECIO,
  descuentoEfectivoPct: CONFIG_PRECIOS_DEFAULT.descuentoEfectivoPct,
  descuentoRetiroPct: CONFIG_PRECIOS_DEFAULT.descuentoRetiroPct,
  descuentoVolumenPct: CONFIG_PRECIOS_DEFAULT.descuentoVolumenPct,
  volumenMinBultos: CONFIG_PRECIOS_DEFAULT.volumenMinBultos,
  acumulaSumando: CONFIG_PRECIOS_DEFAULT.acumulaSumando,
  comisionDefaultPct: CONFIG_COMISIONES_DEFAULT.comisionDefaultPct,
  overridePct: CONFIG_COMISIONES_DEFAULT.overridePct,
};

const CONFIG_DOC = "config/precios";

export function subscribePreciosConfig(
  cb: (c: PreciosConfig) => void
): () => void {
  return onSnapshot(doc(db, CONFIG_DOC), (snap) => {
    if (snap.exists()) {
      const data = snap.data() as Partial<PreciosConfig>;
      cb({
        ...DEFAULT_PRECIOS_CONFIG,
        ...data,
        // Si el doc no trae listas (o vienen vacías), usar las por defecto.
        listas:
          data.listas && data.listas.length > 0
            ? data.listas
            : DEFAULT_PRECIOS_CONFIG.listas,
      });
    } else {
      cb(DEFAULT_PRECIOS_CONFIG);
    }
  });
}

export async function savePreciosConfig(
  patch: Partial<PreciosConfig>
): Promise<void> {
  await setDoc(doc(db, CONFIG_DOC), patch, { merge: true });
}
