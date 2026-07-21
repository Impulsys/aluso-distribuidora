/**
 * Motor de precios de ALUSO.
 *
 * Función PURA: no lee Firestore, no toca la UI. Recibe todo por parámetro y
 * devuelve el precio con el detalle de cómo se llegó. Se hizo así para poder
 * probarla sola y para que el remito pueda mostrar el desglose — si el cliente
 * pregunta "¿por qué me cobraste esto?", la respuesta sale del mismo lugar que
 * el número.
 *
 * Reglas del negocio, tal como las describió el cliente (21/07/2026):
 *
 *   · La mayoría compra con la LISTA DISTRIBUIDOR (el precioVenta del catálogo).
 *   · Algunos clientes tienen LISTA ESPECIAL: no es una tabla de precios propia,
 *     es el COSTO más un porcentaje fijo (11%, 15%, 18%…). Por eso alcanza con
 *     un número en el cliente y no hace falta duplicar el catálogo.
 *   · Sobre la lista distribuidor hay 3 descuentos ACUMULABLES:
 *       2,5% si paga en efectivo · 3% si retira en depósito ·
 *       3% si supera los 150 bultos.
 *   · El de volumen NO aplica cuando la venta la toma un vendedor reclutado
 *     (los que trajo otro vendedor): ese 3% se lo lleva él como comisión.
 *   · Un cliente puntual paga +2,5% si abona por transferencia. Hoy ese recargo
 *     viene metido dentro del precio cargado a mano, y por eso "es un quilombo
 *     volver a calcular" cuando quiere pagar en efectivo. Acá el precio se
 *     guarda BASE y el recargo se aplica según la forma de pago, así cambiar de
 *     transferencia a efectivo recalcula solo.
 *
 * ⚠️ PENDIENTE DE CONFIRMAR CON EL CLIENTE: si "acumulables" significa sumar los
 *    porcentajes (2,5+3+3 = 8,5%) o aplicarlos uno sobre otro (queda 8,27%).
 *    Sobre $100.000 la diferencia es $230 por venta. Se dejó configurable en
 *    `acumulaSumando` y por defecto SUMA, que es la lectura literal de lo que
 *    escribieron y la más fácil de verificar a mano para ellos.
 */

import type { FormaPago } from "./types";

export type ListaTipo = "distribuidor" | "especial";

/** Cómo se le cobra a un cliente. Vive en el documento del cliente. */
export interface PerfilPrecioCliente {
  listaTipo: ListaTipo;
  /** Solo para lista especial: % que se le suma AL COSTO (11, 15, 18…). */
  markupSobreCostoPct?: number;
  /** % que se suma si paga por transferencia. Hoy lo usa un solo cliente. */
  recargoTransferenciaPct?: number;
}

/** Lo que se sabe recién al cerrar la venta. */
export interface CondicionesVenta {
  formaPago: FormaPago;
  /** El cliente retira en el depósito (no hay flete). */
  retiraEnDeposito: boolean;
  /** Bultos totales del pedido, para el descuento por volumen. */
  bultos: number;
  /**
   * La venta la tomó un vendedor reclutado por otro (los "a" y "b"). Si es así
   * NO corresponde el descuento por volumen: ese 3% es su comisión.
   */
  vendedorReclutado?: boolean;
}

export interface ConfigPrecios {
  descuentoEfectivoPct: number;
  descuentoRetiroPct: number;
  descuentoVolumenPct: number;
  volumenMinBultos: number;
  /** true = los % se suman. false = se aplican uno sobre otro. */
  acumulaSumando: boolean;
}

export const CONFIG_PRECIOS_DEFAULT: ConfigPrecios = {
  descuentoEfectivoPct: 2.5,
  descuentoRetiroPct: 3,
  descuentoVolumenPct: 3,
  volumenMinBultos: 150,
  acumulaSumando: true,
};

export interface AjustePrecio {
  concepto: string;
  pct: number;
  /** Negativo si descuenta, positivo si recarga. */
  monto: number;
}

export interface DetallePrecio {
  base: number;
  origenBase: "lista_distribuidor" | "costo_mas_markup";
  ajustes: AjustePrecio[];
  final: number;
}

/** Redondeo a centavos. Sin esto los % dejan colas de 15 decimales. */
function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula el precio unitario de un producto para un cliente y unas condiciones.
 *
 * @param precioLista  precioVenta del catálogo (lista distribuidor)
 * @param precioCosto  costo del producto — solo se usa si el cliente tiene
 *                     lista especial. NO se expone al cliente ni al vendedor.
 */
export function calcularPrecio(
  precioLista: number,
  precioCosto: number,
  perfil: PerfilPrecioCliente,
  cond: CondicionesVenta,
  config: ConfigPrecios = CONFIG_PRECIOS_DEFAULT
): DetallePrecio {
  // ---- 1. Precio base ----
  let base: number;
  let origenBase: DetallePrecio["origenBase"];

  if (perfil.listaTipo === "especial" && (perfil.markupSobreCostoPct ?? 0) > 0) {
    base = precioCosto * (1 + (perfil.markupSobreCostoPct as number) / 100);
    origenBase = "costo_mas_markup";
  } else {
    base = precioLista;
    origenBase = "lista_distribuidor";
  }
  base = r2(base);

  // ---- 2. Descuentos: SOLO sobre la lista distribuidor ----
  // Las listas especiales ya son un precio negociado sobre el costo; encima de
  // eso no corresponde descontar (si no, se vende por debajo del costo).
  const ajustes: AjustePrecio[] = [];
  let pctDescuento = 0;

  if (origenBase === "lista_distribuidor") {
    if (cond.formaPago === "efectivo" && config.descuentoEfectivoPct > 0) {
      pctDescuento += config.descuentoEfectivoPct;
      ajustes.push({ concepto: "Pago en efectivo", pct: -config.descuentoEfectivoPct, monto: 0 });
    }
    if (cond.retiraEnDeposito && config.descuentoRetiroPct > 0) {
      pctDescuento += config.descuentoRetiroPct;
      ajustes.push({ concepto: "Retira en depósito", pct: -config.descuentoRetiroPct, monto: 0 });
    }
    const califica = cond.bultos >= config.volumenMinBultos;
    if (califica && !cond.vendedorReclutado && config.descuentoVolumenPct > 0) {
      pctDescuento += config.descuentoVolumenPct;
      ajustes.push({
        concepto: `Más de ${config.volumenMinBultos} bultos`,
        pct: -config.descuentoVolumenPct,
        monto: 0,
      });
    }
  }

  // ---- 3. Recargo por transferencia (propio del cliente) ----
  const pctRecargo =
    cond.formaPago === "transferencia" ? perfil.recargoTransferenciaPct ?? 0 : 0;

  // ---- 4. Aplicar ----
  let final = base;

  if (config.acumulaSumando) {
    final = base * (1 - pctDescuento / 100);
  } else {
    for (const a of ajustes) final = final * (1 + a.pct / 100);
  }
  if (pctRecargo > 0) {
    ajustes.push({ concepto: "Recargo por transferencia", pct: pctRecargo, monto: 0 });
    final = final * (1 + pctRecargo / 100);
  }
  final = r2(final);

  // Repartir el monto de cada ajuste para que el desglose cierre con el total.
  const deltaTotal = r2(final - base);
  const pctTotal = ajustes.reduce((s, a) => s + Math.abs(a.pct), 0);
  let acumulado = 0;
  ajustes.forEach((a, i) => {
    if (pctTotal === 0) return;
    const esUltimo = i === ajustes.length - 1;
    // Al último se le da el resto, así la suma de los montos == deltaTotal
    // exactamente y no queda un centavo bailando por el redondeo.
    const monto = esUltimo
      ? r2(deltaTotal - acumulado)
      : r2((deltaTotal * Math.abs(a.pct)) / pctTotal);
    a.monto = monto;
    acumulado = r2(acumulado + monto);
  });

  return { base, origenBase, ajustes, final };
}

/** Total de una venta, sumando el precio ya calculado de cada renglón. */
export function totalConDetalle(
  renglones: { cantidad: number; detalle: DetallePrecio }[]
): number {
  return r2(renglones.reduce((s, r) => s + r.detalle.final * r.cantidad, 0));
}
