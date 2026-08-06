/**
 * Optimizador de armado de pallet de ALUSO.
 *
 * Dado lo que lleva un envío (los bultos de cada producto, con sus medidas),
 * ubica cada bulto en el/los pallet(s): calcula una posición 3D para cada uno,
 * apilando en capas, con los pedidos agrupados para que se descarguen juntos.
 * El resultado alimenta el visor 3D.
 *
 * Función PURA: recibe los bultos y las medidas del pallet, devuelve las cajas
 * ubicadas. No lee Firestore ni toca la UI. Todo en centímetros.
 *
 * El algoritmo es un empaquetado por "estantes" (shelf/next-fit): llena una
 * fila a lo ancho, cuando no entra pasa a la fila de atrás, cuando no entra
 * arma una capa arriba, y cuando supera la altura del pallet abre otro pallet.
 * Es simple, no solapa cajas y da un armado válido y prolijo. La optimización
 * fina del surtido se puede refinar después.
 */

export interface BultoAColocar {
  pedidoId: string;
  etiqueta: string; // ej "R-000042 · Cliente"
  color: string; // color del pedido (para el 3D)
  alto: number; // cm
  ancho: number; // cm
  prof: number; // cm
}

export interface CajaColocada extends BultoAColocar {
  pallet: number; // índice de pallet (0, 1, 2…)
  x: number; // posición desde la izquierda (a lo ancho)
  y: number; // posición desde el frente (a lo profundo)
  z: number; // altura desde la base
}

export interface PalletDims {
  ancho: number; // cm (típico 120)
  prof: number; // cm (típico 100)
  alto: number; // cm máximo apilable (típico 180)
}

export const PALLET_ESTANDAR: PalletDims = { ancho: 120, prof: 100, alto: 180 };

export interface ResultadoPallet {
  cajas: CajaColocada[];
  pallets: number; // cantidad de pallets usados
}

export interface OpcionesPallet {
  /**
   * No surtir: cada pedido arma SUS propios pallets, nunca compartidos con
   * otro cliente. Al cambiar de pedido se abre un pallet nuevo aunque sobre
   * lugar en el anterior. Es como despacha ALUSO la mayoría de las veces.
   */
  separarPedidos?: boolean;
}

/**
 * @param bultos  todos los bultos a cargar (uno por bulto físico)
 * @param pallet  medidas del pallet
 * @param opts    separarPedidos = un pallet por cliente (no surtir)
 */
export function armarPallet(
  bultos: BultoAColocar[],
  pallet: PalletDims = PALLET_ESTANDAR,
  opts: OpcionesPallet = {}
): ResultadoPallet {
  // Los pedidos se procesan juntos (para descargar por cliente), y dentro de
  // cada pedido los bultos más grandes primero (van abajo, más estables).
  const porPedido = new Map<string, BultoAColocar[]>();
  for (const b of bultos) {
    if (!porPedido.has(b.pedidoId)) porPedido.set(b.pedidoId, []);
    porPedido.get(b.pedidoId)!.push(b);
  }
  const orden: BultoAColocar[] = [];
  for (const grupo of porPedido.values()) {
    grupo.sort((a, b) => b.ancho * b.prof - a.ancho * a.prof);
    orden.push(...grupo);
  }

  const cajas: CajaColocada[] = [];
  let pIdx = 0;
  let x = 0,
    y = 0,
    z = 0;
  let profFila = 0; // profundidad máxima de la fila actual
  let altoCapa = 0; // altura máxima de la capa actual
  let pedidoActual: string | null = null;
  let hayEnPallet = false; // ¿el pallet actual ya tiene algo?

  for (const b of orden) {
    // Sin surtir: al cambiar de cliente, pallet nuevo (aunque sobre lugar).
    if (
      opts.separarPedidos &&
      pedidoActual !== null &&
      b.pedidoId !== pedidoActual
    ) {
      pIdx += 1;
      x = 0;
      y = 0;
      z = 0;
      profFila = 0;
      altoCapa = 0;
      hayEnPallet = false;
    }
    pedidoActual = b.pedidoId;

    // Si el bulto es más ancho que el pallet, lo apoyamos igual (se sale un
    // poco): mejor mostrarlo que perderlo. Caso raro.
    if (x + b.ancho > pallet.ancho + 0.01) {
      // Nueva fila (hacia el fondo).
      x = 0;
      y += profFila;
      profFila = 0;
    }
    if (y + b.prof > pallet.prof + 0.01) {
      // Nueva capa (hacia arriba).
      x = 0;
      y = 0;
      profFila = 0;
      z += altoCapa;
      altoCapa = 0;
    }
    if (z + b.alto > pallet.alto + 0.01 && hayEnPallet) {
      // No entra en altura → pallet nuevo. Solo si el pallet ya tiene algo: si
      // el primer bulto ya es más alto que el pallet, lo apoyamos igual (como
      // el caso "más ancho que el pallet") en vez de dejar un pallet vacío.
      pIdx += 1;
      x = 0;
      y = 0;
      z = 0;
      profFila = 0;
      altoCapa = 0;
      hayEnPallet = false;
    }

    cajas.push({ ...b, pallet: pIdx, x, y, z });
    hayEnPallet = true;

    x += b.ancho;
    profFila = Math.max(profFila, b.prof);
    altoCapa = Math.max(altoCapa, b.alto);
  }

  return { cajas, pallets: bultos.length > 0 ? pIdx + 1 : 0 };
}

/** Paleta de colores para distinguir pedidos en el 3D. */
export const COLORES_PEDIDO = [
  "#2f6fb0",
  "#e0713a",
  "#3a9e6b",
  "#b0472f",
  "#8155b5",
  "#c2185b",
  "#0a8db5",
  "#b08a2f",
];
