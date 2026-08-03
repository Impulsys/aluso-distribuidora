/**
 * Calculadora de costo logístico de ALUSO.
 *
 * El problema real que resuelve, en palabras del cliente: llega un flete con un
 * costo total, el palet viene MEZCLADO (distintos productos, distintas
 * cantidades) y hay que saber cuánto de ese flete le corresponde a cada
 * paquete. Con eso se sabe el costo logístico real por producto y se puede
 * sumar al costo de la mercadería.
 *
 * Función PURA: no lee Firestore ni toca la UI. Recibe el costo del flete y qué
 * vino, y devuelve el reparto con el detalle. Se hizo así para poder probarla
 * sola y para que la pantalla muestre exactamente cómo se llegó a cada número.
 *
 * El reparto es PROPORCIONAL. Un flete se paga por el lugar que ocupa la
 * mercadería (volumen) o por lo que pesa. Los pañales y el algodón son
 * voluminosos y livianos, así que por defecto se reparte por VOLUMEN (m³), que
 * es como cobra la mayoría de los transportes de este rubro. Se puede cambiar a
 * peso si el flete se cobró así.
 */

export type CriterioReparto = "volumen" | "peso";

/** Una línea de la carga: un producto y cuántos BULTOS llegaron. */
export interface LineaCarga {
  ean: string;
  nombre: string;
  bultos: number;
  /** m³ que ocupa un bulto. De la planilla de datos logísticos. */
  m3Bulto: number;
  /** Peso de un bulto en kg. */
  pesoBultoKg: number;
  /** Unidades/paquetes que trae un bulto (para el costo por paquete). */
  paqPorBulto: number;
}

export interface RepartoLinea {
  ean: string;
  nombre: string;
  bultos: number;
  /** Magnitud total de esta línea según el criterio (m³ o kg totales). */
  magnitud: number;
  /** Qué proporción del total representa (0..1). */
  proporcion: number;
  /** Costo de flete imputado a TODA la línea. */
  costoLinea: number;
  /** Costo de flete por bulto. */
  costoPorBulto: number;
  /** Costo de flete por paquete/unidad de venta. */
  costoPorPaquete: number;
}

export interface ResultadoReparto {
  criterio: CriterioReparto;
  costoFlete: number;
  magnitudTotal: number;
  lineas: RepartoLinea[];
  /** Lo que no se pudo repartir por redondeo (debería ser ~0). */
  sinRepartir: number;
}

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ===== Volumen de un envío (para programar la logística) =====

/** m³ que ocupa UN pallet armado, aprox. Configurable a futuro. */
export const M3_POR_PALLET = 1.6;

export interface ItemVolumen {
  ean: string;
  /** Unidades vendidas (no bultos). */
  cantidad: number;
  m3Bulto: number;
  paqPorBulto: number;
}

export interface Volumen {
  m3: number;
  bultos: number;
  pallets: number;
}

/**
 * Calcula el volumen total de un envío a partir de los productos que lleva.
 *
 * La cantidad de los ítems está en UNIDADES (así se cargan hoy los precios), y
 * cada bulto trae `paqPorBulto` unidades, así que los bultos = unidades /
 * paqPorBulto. El volumen es proporcional (un bulto a medias ocupa su parte).
 * Los pallets son una ESTIMACIÓN (m³ total / m³ por pallet); el armado fino del
 * pallet surtido se define aparte.
 */
export function volumenDeEnvio(items: ItemVolumen[]): Volumen {
  let m3 = 0;
  let bultos = 0;
  for (const it of items) {
    if (it.cantidad <= 0 || it.paqPorBulto <= 0) continue;
    const b = it.cantidad / it.paqPorBulto;
    bultos += b;
    m3 += b * it.m3Bulto;
  }
  return {
    m3: r2(m3),
    bultos: Math.round(bultos * 10) / 10,
    pallets: m3 > 0 ? Math.ceil(m3 / M3_POR_PALLET) : 0,
  };
}

/**
 * Reparte el costo de un flete entre las líneas de la carga.
 *
 * @param costoFlete  costo total del flete (ARS)
 * @param lineas      qué vino en la carga
 * @param criterio    "volumen" (m³, por defecto) o "peso" (kg)
 */
export function repartirFlete(
  costoFlete: number,
  lineas: LineaCarga[],
  criterio: CriterioReparto = "volumen"
): ResultadoReparto {
  const magnitudDe = (l: LineaCarga) =>
    (criterio === "volumen" ? l.m3Bulto : l.pesoBultoKg) * l.bultos;

  const activas = lineas.filter((l) => l.bultos > 0);
  const magnitudTotal = activas.reduce((s, l) => s + magnitudDe(l), 0);

  // Sin magnitud total (nadie tiene medidas, o 0 bultos) no se puede repartir:
  // devolvemos todo en cero en vez de dividir por cero e inventar números.
  if (magnitudTotal <= 0) {
    return {
      criterio,
      costoFlete: r2(costoFlete),
      magnitudTotal: 0,
      lineas: activas.map((l) => ({
        ean: l.ean,
        nombre: l.nombre,
        bultos: l.bultos,
        magnitud: 0,
        proporcion: 0,
        costoLinea: 0,
        costoPorBulto: 0,
        costoPorPaquete: 0,
      })),
      sinRepartir: r2(costoFlete),
    };
  }

  let acumulado = 0;
  const salida: RepartoLinea[] = activas.map((l, i) => {
    const magnitud = magnitudDe(l);
    const proporcion = magnitud / magnitudTotal;
    // Al último se le da el resto exacto, para que la suma de los costos de
    // línea cierre CENTAVO A CENTAVO con el flete y no quede un peso bailando.
    const esUltimo = i === activas.length - 1;
    const costoLinea = esUltimo
      ? r2(costoFlete - acumulado)
      : r2(costoFlete * proporcion);
    acumulado = r2(acumulado + costoLinea);

    const paquetesTotales = l.paqPorBulto > 0 ? l.paqPorBulto * l.bultos : 0;
    return {
      ean: l.ean,
      nombre: l.nombre,
      bultos: l.bultos,
      magnitud: Math.round(magnitud * 1e6) / 1e6,
      proporcion,
      costoLinea,
      costoPorBulto: r2(costoLinea / l.bultos),
      costoPorPaquete: paquetesTotales > 0 ? r2(costoLinea / paquetesTotales) : 0,
    };
  });

  const repartido = salida.reduce((s, l) => s + l.costoLinea, 0);
  return {
    criterio,
    costoFlete: r2(costoFlete),
    magnitudTotal: Math.round(magnitudTotal * 1e6) / 1e6,
    lineas: salida,
    sinRepartir: r2(costoFlete - repartido),
  };
}
