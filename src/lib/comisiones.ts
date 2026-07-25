/**
 * Motor de comisiones de vendedores de ALUSO.
 *
 * El esquema que describió el cliente (formulario, 21/07):
 *  · Cada vendedor comisiona un % de lo que vende (por defecto 3%).
 *  · Un vendedor puede haber sido RECLUTADO por otro. El que lo trajo se lleva,
 *    ADEMÁS, un % (override) de lo que vende el reclutado. Los dos cobran: el
 *    reclutado su 3% y el reclutador su 3% encima.
 *  · Las ventas a clientes propios de la casa (no de un vendedor) no comisionan.
 *
 * ⚠️ A CONFIRMAR CON EL CLIENTE: si ese 3% del override sale de la ganancia de
 *    ALUSO (lo más natural por cómo está redactado: "ellos comisionan el 3% y X
 *    se lleva también un 3%") o si sale del 3% del reclutado. Acá se implementó
 *    como ADICIONAL (de ALUSO), que es la lectura literal. Es un parámetro, así
 *    que si es al revés se cambia sin tocar el resto.
 *
 * Función PURA: recibe los vendedores, las ventas del período y la config, y
 * devuelve cuánto cobra cada uno con el detalle. No lee Firestore ni toca UI.
 */

export interface VendedorComision {
  uid: string;
  nombre: string;
  /** % que cobra sobre SUS ventas. Si no está, usa el default de la config. */
  comisionPct?: number;
  /** uid del vendedor que lo reclutó (si aplica el override). */
  reclutadoPor?: string;
}

export interface VentaVendedor {
  vendedorUid: string;
  monto: number;
}

export interface ConfigComisiones {
  /** % por defecto que cobra un vendedor sobre sus ventas. */
  comisionDefaultPct: number;
  /** % que cobra el reclutador sobre lo que vende cada reclutado. */
  overridePct: number;
}

export const CONFIG_COMISIONES_DEFAULT: ConfigComisiones = {
  comisionDefaultPct: 3,
  overridePct: 3,
};

export interface LineaOverride {
  reclutadoUid: string;
  reclutadoNombre: string;
  ventas: number;
  monto: number;
}

export interface ResultadoComision {
  uid: string;
  nombre: string;
  comisionPct: number;
  ventasPropias: number;
  comisionPropia: number;
  /** Detalle del override por cada reclutado. */
  overridePorReclutado: LineaOverride[];
  overrideTotal: number;
  total: number;
}

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula la comisión de cada vendedor para un período.
 *
 * @param vendedores  todos los vendedores (con su % y quién los reclutó)
 * @param ventas      ventas del período, ya atribuidas a un vendedor. Las
 *                    ventas de la casa (sin vendedor) no vienen acá.
 */
export function calcularComisiones(
  vendedores: VendedorComision[],
  ventas: VentaVendedor[],
  config: ConfigComisiones = CONFIG_COMISIONES_DEFAULT
): ResultadoComision[] {
  // Total vendido por cada vendedor en el período.
  const ventasPorUid = new Map<string, number>();
  for (const v of ventas) {
    if (!v.vendedorUid) continue;
    ventasPorUid.set(v.vendedorUid, (ventasPorUid.get(v.vendedorUid) ?? 0) + v.monto);
  }

  return vendedores.map((v) => {
    const pct = v.comisionPct ?? config.comisionDefaultPct;
    const ventasPropias = r2(ventasPorUid.get(v.uid) ?? 0);
    const comisionPropia = r2((ventasPropias * pct) / 100);

    // Override: lo que este vendedor cobra por los que reclutó.
    const reclutados = vendedores.filter((x) => x.reclutadoPor === v.uid);
    const overridePorReclutado: LineaOverride[] = reclutados.map((r) => {
      const ventasR = r2(ventasPorUid.get(r.uid) ?? 0);
      return {
        reclutadoUid: r.uid,
        reclutadoNombre: r.nombre,
        ventas: ventasR,
        monto: r2((ventasR * config.overridePct) / 100),
      };
    });
    const overrideTotal = r2(
      overridePorReclutado.reduce((s, o) => s + o.monto, 0)
    );

    return {
      uid: v.uid,
      nombre: v.nombre,
      comisionPct: pct,
      ventasPropias,
      comisionPropia,
      overridePorReclutado,
      overrideTotal,
      total: r2(comisionPropia + overrideTotal),
    };
  });
}
