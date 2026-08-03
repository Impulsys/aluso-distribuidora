// ===== Datos logísticos por producto — ALUSO =====
// Extraídos de la planilla del cliente "PLANILLA DATOS LOGISTICOS 2026" (hoja
// JUNIO 2026). Sirven para repartir el costo de un flete entre los productos de
// una carga mezclada, según el volumen (m³) o el peso de cada bulto.
//
// Se indexan por EAN, que es estable entre versiones de la planilla y del
// catálogo. Un producto sin fila acá simplemente no puede entrar al cálculo
// por volumen hasta que se carguen sus medidas.
//
// m3Bulto  = metros cúbicos que ocupa UN bulto (caja completa) del producto.
// pesoBultoKg = peso bruto de UN bulto.
// paqPorBulto = cuántos paquetes/unidades de venta trae el bulto.

export interface DatoLogistico {
  ean: string;
  cod: string;
  paqPorBulto: number;
  pesoBultoKg: number;
  m3Bulto: number;
  /** Medidas del bulto en cm (alto × ancho × profundidad). Opcionales: cuando
   *  no están, el armado del pallet las estima del m³ como un cubo. Se cargan
   *  exactas de la planilla "Datos Logísticos" (columnas ALTURA/ANCHO/PROF bulto). */
  altoBultoCm?: number;
  anchoBultoCm?: number;
  profBultoCm?: number;
}

/** Medidas de un bulto en cm. Si no hay medidas exactas, arma un cubo del m³. */
export function medidasBulto(d: DatoLogistico): {
  alto: number;
  ancho: number;
  prof: number;
} {
  if (d.altoBultoCm && d.anchoBultoCm && d.profBultoCm) {
    return { alto: d.altoBultoCm, ancho: d.anchoBultoCm, prof: d.profBultoCm };
  }
  // Estimación: cubo equivalente al m³ (lado = raíz cúbica del volumen).
  const ladoCm = Math.cbrt(Math.max(d.m3Bulto, 0.000001)) * 100;
  return { alto: ladoCm, ancho: ladoCm, prof: ladoCm };
}

export const DATOS_LOGISTICOS: DatoLogistico[] = [
  { ean: "7790940003034", cod: "12101", paqPorBulto: 40, pesoBultoKg: 2.9, m3Bulto: 0.026244, altoBultoCm: 18, anchoBultoCm: 27, profBultoCm: 54 },
  { ean: "7790940000026", cod: "12104", paqPorBulto: 20, pesoBultoKg: 2.9, m3Bulto: 0.04725, altoBultoCm: 22.5, anchoBultoCm: 35, profBultoCm: 60 },
  { ean: "7790940003089", cod: "12103", paqPorBulto: 10, pesoBultoKg: 3.1, m3Bulto: 0.042656, altoBultoCm: 21.5, anchoBultoCm: 32, profBultoCm: 62 },
  { ean: "7790940003065", cod: "12306", paqPorBulto: 10, pesoBultoKg: 5.1, m3Bulto: 0.1, altoBultoCm: 23, anchoBultoCm: 44, profBultoCm: 86 },
  { ean: "7790940000033", cod: "11302", paqPorBulto: 40, pesoBultoKg: 4.3, m3Bulto: 0.0432, altoBultoCm: 24, anchoBultoCm: 36, profBultoCm: 50 },
  { ean: "7790940000040", cod: "11303", paqPorBulto: 20, pesoBultoKg: 4.1, m3Bulto: 0.042336, altoBultoCm: 28, anchoBultoCm: 27, profBultoCm: 56 },
  { ean: "7790940112996", cod: "11299", paqPorBulto: 40, pesoBultoKg: 4.3, m3Bulto: 0.0432, altoBultoCm: 24, anchoBultoCm: 36, profBultoCm: 50 },
  { ean: "7790940515032", cod: "51503", paqPorBulto: 12, pesoBultoKg: 0.8, m3Bulto: 0.011638, altoBultoCm: 24.5, anchoBultoCm: 25, profBultoCm: 19 },
  { ean: "7790940515209", cod: "21520", paqPorBulto: 12, pesoBultoKg: 0, m3Bulto: 0 },
  { ean: "7790940216168", cod: "21616", paqPorBulto: 50, pesoBultoKg: 2.92, m3Bulto: 0.0255, altoBultoCm: 17, anchoBultoCm: 37.5, profBultoCm: 40 },
  { ean: "7790940216205", cod: "21620", paqPorBulto: 50, pesoBultoKg: 2.4, m3Bulto: 0.025568, altoBultoCm: 17, anchoBultoCm: 32, profBultoCm: 47 },
  { ean: "7790940216151", cod: "21615", paqPorBulto: 50, pesoBultoKg: 3.12, m3Bulto: 0.0255, altoBultoCm: 17, anchoBultoCm: 37.5, profBultoCm: 40 },
  { ean: "7790940216144", cod: "21614", paqPorBulto: 50, pesoBultoKg: 3.12, m3Bulto: 0.0255, altoBultoCm: 17, anchoBultoCm: 37.5, profBultoCm: 40 },
  { ean: "7790940518026", cod: "51802", paqPorBulto: 50, pesoBultoKg: 4.06, m3Bulto: 0.02652, altoBultoCm: 17, anchoBultoCm: 39, profBultoCm: 40 },
  { ean: "7790940518033", cod: "51803", paqPorBulto: 50, pesoBultoKg: 5.05, m3Bulto: 0.034, altoBultoCm: 20, anchoBultoCm: 40, profBultoCm: 42.5 },
  { ean: "7790940518040", cod: "51804", paqPorBulto: 20, pesoBultoKg: 4.62, m3Bulto: 0.036, altoBultoCm: 18, anchoBultoCm: 50, profBultoCm: 40 },
  { ean: "7790940518057", cod: "51805", paqPorBulto: 20, pesoBultoKg: 6.63, m3Bulto: 0.04719, altoBultoCm: 19.5, anchoBultoCm: 55, profBultoCm: 44 },
  { ean: "7790940518064", cod: "51806", paqPorBulto: 6, pesoBultoKg: 4.2, m3Bulto: 0.03548, altoBultoCm: 21.5, anchoBultoCm: 33, profBultoCm: 55 },
  { ean: "7790940518071", cod: "51807", paqPorBulto: 6, pesoBultoKg: 5.7, m3Bulto: 0.04158, altoBultoCm: 21, anchoBultoCm: 33, profBultoCm: 60 },
  { ean: "7790940216212", cod: "21621", paqPorBulto: 25, pesoBultoKg: 3.1, m3Bulto: 0.0272, altoBultoCm: 16, anchoBultoCm: 40, profBultoCm: 42.5 },
  { ean: "7790940216229", cod: "21622", paqPorBulto: 25, pesoBultoKg: 3.1, m3Bulto: 0.0272, altoBultoCm: 16, anchoBultoCm: 40, profBultoCm: 42.5 },
  { ean: "7790940216274", cod: "21627", paqPorBulto: 50, pesoBultoKg: 3.02, m3Bulto: 0.028, altoBultoCm: 14, anchoBultoCm: 37.5, profBultoCm: 40 },
  { ean: "7790940216236", cod: "21623", paqPorBulto: 50, pesoBultoKg: 3.02, m3Bulto: 0.028, altoBultoCm: 14, anchoBultoCm: 37.5, profBultoCm: 40 },
  { ean: "7790940216250", cod: "21625", paqPorBulto: 25, pesoBultoKg: 3.1, m3Bulto: 0.0272, altoBultoCm: 16, anchoBultoCm: 40, profBultoCm: 42.5 },
  { ean: "7790940216243", cod: "21624", paqPorBulto: 50, pesoBultoKg: 3.6, m3Bulto: 0.032, altoBultoCm: 14, anchoBultoCm: 42.5, profBultoCm: 40 },
  { ean: "7790940216267", cod: "21626", paqPorBulto: 25, pesoBultoKg: 3.6, m3Bulto: 0.032, altoBultoCm: 20, anchoBultoCm: 42.5, profBultoCm: 42.5 },
  { ean: "7790940233240", cod: "23500", paqPorBulto: 30, pesoBultoKg: 1.5, m3Bulto: 0.007128, altoBultoCm: 11, anchoBultoCm: 24, profBultoCm: 27 },
  { ean: "7790940233264", cod: "23502", paqPorBulto: 30, pesoBultoKg: 1.5, m3Bulto: 0.007128, altoBultoCm: 11, anchoBultoCm: 24, profBultoCm: 27 },
  { ean: "7790940233257", cod: "23501", paqPorBulto: 15, pesoBultoKg: 1.5, m3Bulto: 0.007128, altoBultoCm: 11, anchoBultoCm: 24, profBultoCm: 27 },
  { ean: "7790940234032", cod: "23503", paqPorBulto: 15, pesoBultoKg: 1.5, m3Bulto: 0.007128, altoBultoCm: 10, anchoBultoCm: 36, profBultoCm: 27 },
  { ean: "7790940233004", cod: "23300", paqPorBulto: 30, pesoBultoKg: 0.8, m3Bulto: 0.01026, altoBultoCm: 10, anchoBultoCm: 38, profBultoCm: 27 },
  { ean: "7790940233011", cod: "23301", paqPorBulto: 30, pesoBultoKg: 1.6, m3Bulto: 0.00972, altoBultoCm: 10, anchoBultoCm: 36, profBultoCm: 27 },
  { ean: "7790940235077", cod: "23400", paqPorBulto: 30, pesoBultoKg: 1.6, m3Bulto: 0.00972, altoBultoCm: 10, anchoBultoCm: 36, profBultoCm: 27 },
  { ean: "7790940235084", cod: "23401", paqPorBulto: 30, pesoBultoKg: 1.6, m3Bulto: 0.00972, altoBultoCm: 10, anchoBultoCm: 36, profBultoCm: 27 },
  { ean: "7790940234025", cod: "23402", paqPorBulto: 15, pesoBultoKg: 1.6, m3Bulto: 0.00972, altoBultoCm: 10, anchoBultoCm: 36, profBultoCm: 27 },
  { ean: "7790940234032", cod: "23403", paqPorBulto: 15, pesoBultoKg: 1.6, m3Bulto: 0.00972, altoBultoCm: 10, anchoBultoCm: 36, profBultoCm: 27 },
  { ean: "7790940234049", cod: "23404", paqPorBulto: 10, pesoBultoKg: 1.6, m3Bulto: 0.00972, altoBultoCm: 10, anchoBultoCm: 36, profBultoCm: 27 },
  { ean: "7790940000071", cod: "11135", paqPorBulto: 8, pesoBultoKg: 6.4, m3Bulto: 0.06256, altoBultoCm: 17, anchoBultoCm: 40, profBultoCm: 92 },
  { ean: "7790940000088", cod: "11103", paqPorBulto: 4, pesoBultoKg: 6.4, m3Bulto: 0.06256, altoBultoCm: 17, anchoBultoCm: 40, profBultoCm: 92 },
  { ean: "7790940410061", cod: "41006", paqPorBulto: 2, pesoBultoKg: 8, m3Bulto: 0.07038, altoBultoCm: 17, anchoBultoCm: 45, profBultoCm: 92 },
  { ean: "7790940000095", cod: "11136", paqPorBulto: 8, pesoBultoKg: 6.6, m3Bulto: 0.06256, altoBultoCm: 17, anchoBultoCm: 40, profBultoCm: 92 },
  { ean: "7790940000101", cod: "11107", paqPorBulto: 4, pesoBultoKg: 6.6, m3Bulto: 0.06256, altoBultoCm: 17, anchoBultoCm: 40, profBultoCm: 92 },
  { ean: "7790940410078", cod: "41007", paqPorBulto: 2, pesoBultoKg: 8.2, m3Bulto: 0.07038, altoBultoCm: 17, anchoBultoCm: 45, profBultoCm: 92 },
  { ean: "7790940410177", cod: "41017", paqPorBulto: 8, pesoBultoKg: 7.2, m3Bulto: 0.0714, altoBultoCm: 17, anchoBultoCm: 42, profBultoCm: 100 },
  { ean: "7790940410184", cod: "41018", paqPorBulto: 4, pesoBultoKg: 7.2, m3Bulto: 0.0714, altoBultoCm: 17, anchoBultoCm: 42, profBultoCm: 100 },
  { ean: "7790940410146", cod: "41014", paqPorBulto: 2, pesoBultoKg: 7.2, m3Bulto: 0.07038, altoBultoCm: 17, anchoBultoCm: 45, profBultoCm: 92 },
  { ean: "7790940410153", cod: "41015", paqPorBulto: 2, pesoBultoKg: 7.5, m3Bulto: 0.07038, altoBultoCm: 17, anchoBultoCm: 45, profBultoCm: 92 },
  { ean: "7790940410245", cod: "41024", paqPorBulto: 10, pesoBultoKg: 7.55, m3Bulto: 0.07392, altoBultoCm: 24, anchoBultoCm: 40, profBultoCm: 77 },
  { ean: "7790940410252", cod: "41025", paqPorBulto: 10, pesoBultoKg: 8.3, m3Bulto: 0.083424, altoBultoCm: 24, anchoBultoCm: 44, profBultoCm: 79 },
  { ean: "7790940410269", cod: "41026", paqPorBulto: 5, pesoBultoKg: 8.35, m3Bulto: 0.071687, altoBultoCm: 24.5, anchoBultoCm: 38, profBultoCm: 77 },
  { ean: "7790940410276", cod: "41027", paqPorBulto: 5, pesoBultoKg: 9.45, m3Bulto: 0.0847, altoBultoCm: 27.5, anchoBultoCm: 40, profBultoCm: 77 },
  { ean: "7790940410504", cod: "41050", paqPorBulto: 10, pesoBultoKg: 8.35, m3Bulto: 0.077, altoBultoCm: 20, anchoBultoCm: 50, profBultoCm: 77 },
  { ean: "7790940410511", cod: "41051", paqPorBulto: 10, pesoBultoKg: 9.45, m3Bulto: 0.088935, altoBultoCm: 21, anchoBultoCm: 55, profBultoCm: 77 },
  { ean: "7790940410528", cod: "41052", paqPorBulto: 5, pesoBultoKg: 8.35, m3Bulto: 0.071687, altoBultoCm: 24.5, anchoBultoCm: 38, profBultoCm: 77 },
  { ean: "7790940410535", cod: "41053", paqPorBulto: 5, pesoBultoKg: 9.45, m3Bulto: 0.0847, altoBultoCm: 27.5, anchoBultoCm: 40, profBultoCm: 77 },
  { ean: "7790940411266", cod: "41126", paqPorBulto: 10, pesoBultoKg: 7.5, m3Bulto: 0.054, altoBultoCm: 18, anchoBultoCm: 40, profBultoCm: 75 },
  { ean: "7790940411273", cod: "41127", paqPorBulto: 10, pesoBultoKg: 8.4, m3Bulto: 0.05832, altoBultoCm: 18, anchoBultoCm: 40, profBultoCm: 81 },
  { ean: "7790940411280", cod: "41127", paqPorBulto: 10, pesoBultoKg: 0, m3Bulto: 0.06 },
  { ean: "7790940110008", cod: "11005", paqPorBulto: 8, pesoBultoKg: 4.2, m3Bulto: 0.0544, altoBultoCm: 17, anchoBultoCm: 40, profBultoCm: 80 },
  { ean: "7790940888327", cod: "11008", paqPorBulto: 8, pesoBultoKg: 4.55, m3Bulto: 0.05084, altoBultoCm: 62, anchoBultoCm: 41, profBultoCm: 20 },
  { ean: "7790940110046", cod: "11004", paqPorBulto: 10, pesoBultoKg: 4.8, m3Bulto: 0.0532, altoBultoCm: 19, anchoBultoCm: 40, profBultoCm: 70 },
  { ean: "7790940110077", cod: "11007", paqPorBulto: 10, pesoBultoKg: 4.8, m3Bulto: 0.053, altoBultoCm: 19, anchoBultoCm: 40, profBultoCm: 70 },
  { ean: "7790940516565", cod: "51656", paqPorBulto: 12, pesoBultoKg: 5.07, m3Bulto: 0.01596, altoBultoCm: 16, anchoBultoCm: 28.5, profBultoCm: 35 },
  { ean: "7790940000019", cod: "51600", paqPorBulto: 20, pesoBultoKg: 4, m3Bulto: 0.045, altoBultoCm: 10, anchoBultoCm: 60, profBultoCm: 75 },
  { ean: "7790940516503", cod: "51650", paqPorBulto: 20, pesoBultoKg: 4.2, m3Bulto: 0.045, altoBultoCm: 10, anchoBultoCm: 60, profBultoCm: 75 },
  { ean: "7790940516602", cod: "51660", paqPorBulto: 10, pesoBultoKg: 4.2, m3Bulto: 0.045, altoBultoCm: 10, anchoBultoCm: 60, profBultoCm: 75 },
  { ean: "7790940516527", cod: "51651", paqPorBulto: 6, pesoBultoKg: 3.4, m3Bulto: 0.0377, altoBultoCm: 13, anchoBultoCm: 50, profBultoCm: 58 },
  { ean: "7790940516619", cod: "51661", paqPorBulto: 12, pesoBultoKg: 3.45, m3Bulto: 0.038532, altoBultoCm: 13, anchoBultoCm: 39, profBultoCm: 76 },
  { ean: "7790940516596", cod: "51659", paqPorBulto: 6, pesoBultoKg: 7.26, m3Bulto: 0.0795, altoBultoCm: 100, anchoBultoCm: 53, profBultoCm: 15 },
  { ean: "7790940111340", cod: "11134", paqPorBulto: 6, pesoBultoKg: 3.4, m3Bulto: 0.0377, altoBultoCm: 13, anchoBultoCm: 50, profBultoCm: 58 },
  { ean: "7790940516626", cod: "51662", paqPorBulto: 12, pesoBultoKg: 3.4, m3Bulto: 0.038532, altoBultoCm: 13, anchoBultoCm: 39, profBultoCm: 76 },
  { ean: "7790940111302", cod: "11130", paqPorBulto: 6, pesoBultoKg: 6.3, m3Bulto: 0.081, altoBultoCm: 15, anchoBultoCm: 54, profBultoCm: 100 },
  { ean: "7790940111197", cod: "11119", paqPorBulto: 6, pesoBultoKg: 0, m3Bulto: 0.076, altoBultoCm: 15, anchoBultoCm: 51, profBultoCm: 100 },
  { ean: "7790940516541", cod: "51654", paqPorBulto: 6, pesoBultoKg: 6, m3Bulto: 0.078, altoBultoCm: 15, anchoBultoCm: 52, profBultoCm: 100 },
  { ean: "7790940516640", cod: "51664", paqPorBulto: 12, pesoBultoKg: 6.04, m3Bulto: 0.072, altoBultoCm: 15, anchoBultoCm: 48, profBultoCm: 100 },
  { ean: "7790940515551", cod: "51555", paqPorBulto: 6, pesoBultoKg: 6.8, m3Bulto: 0.0688, altoBultoCm: 16, anchoBultoCm: 50, profBultoCm: 86 },
  { ean: "7790940215109", cod: "21510", paqPorBulto: 24, pesoBultoKg: 4.2, m3Bulto: 0.0216, altoBultoCm: 18, anchoBultoCm: 40, profBultoCm: 30 },
  { ean: "7790940215116", cod: "21511", paqPorBulto: 24, pesoBultoKg: 4.2, m3Bulto: 0.0216, altoBultoCm: 18, anchoBultoCm: 40, profBultoCm: 30 },
  { ean: "7790940215147", cod: "21514", paqPorBulto: 20, pesoBultoKg: 0, m3Bulto: 0 },
  { ean: "7790940801234", cod: "80123", paqPorBulto: 12, pesoBultoKg: 6.6, m3Bulto: 0.01449, altoBultoCm: 23, anchoBultoCm: 30, profBultoCm: 21 },
  { ean: "7790940801227", cod: "80122", paqPorBulto: 6, pesoBultoKg: 6.6, m3Bulto: 0.011723, altoBultoCm: 29, anchoBultoCm: 16.5, profBultoCm: 24.5 },
  { ean: "7790940801067", cod: "80100", paqPorBulto: 24, pesoBultoKg: 1, m3Bulto: 0.008048, altoBultoCm: 9, anchoBultoCm: 36.5, profBultoCm: 24.5 },
  { ean: "7790940515025", cod: "51502", paqPorBulto: 24, pesoBultoKg: 1.83, m3Bulto: 0.020769, altoBultoCm: 21, anchoBultoCm: 43, profBultoCm: 23 },
  { ean: "7790940515063", cod: "51506", paqPorBulto: 12, pesoBultoKg: 1.55, m3Bulto: 0.020045, altoBultoCm: 21, anchoBultoCm: 41.5, profBultoCm: 23 },
  { ean: "7790940516572", cod: "51657", paqPorBulto: 20, pesoBultoKg: 1.81, m3Bulto: 0.03315, altoBultoCm: 26, anchoBultoCm: 50, profBultoCm: 25.5 },
  { ean: "7790940516589", cod: "51658", paqPorBulto: 20, pesoBultoKg: 1.81, m3Bulto: 0.03315, altoBultoCm: 26, anchoBultoCm: 50, profBultoCm: 25.5 },
];

export const LOGISTICA_POR_EAN: Record<string, DatoLogistico> = Object.fromEntries(
  DATOS_LOGISTICOS.map((d) => [d.ean, d])
);
