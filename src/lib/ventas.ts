// Ventas: Remitos (descuentan stock) y Facturas (no tocan stock).
// Escritura solo superadmin; lectura socio/superadmin (ver firestore.rules).
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  runTransaction,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { logActivity } from "./bitacora";
import { formatARS } from "./format";
import type {
  Factura,
  FormaPago,
  Order,
  Remito,
  RemitoItem,
} from "./types";

/** Traduce los errores de venta a un mensaje legible para mostrar al usuario. */
export function mensajeVentaError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? "";
  if (msg.startsWith("STOCK_INSUFICIENTE|")) {
    const [, nombre, disp] = msg.split("|");
    return `Stock insuficiente de "${nombre}" (quedan ${disp}). Ajustá la cantidad o cargá stock.`;
  }
  if (msg === "PEDIDO_YA_REMITIDO") return "Este pedido ya tiene un remito generado.";
  if (msg === "REMITO_YA_FACTURADO")
    return "Este remito ya fue facturado. Anulá la factura antes de anular la venta.";
  if (msg === "REMITO_YA_ANULADO") return "Esta venta ya está anulada.";
  if (msg === "REMITO_NO_EXISTE") return "No se encontró el remito.";
  return "No se pudo completar la operación. Intentá de nuevo.";
}

/**
 * Anula una venta (remito): devuelve el stock de cada ítem y marca el remito
 * como anulado. Atómico. No se puede anular si ya fue facturado.
 */
export async function anularRemito(
  remito: Remito,
  anuladoPor?: string
): Promise<void> {
  const remitoRef = doc(db, "remitos", remito.id);

  await runTransaction(db, async (tx) => {
    // ---- LECTURAS (todas antes de cualquier escritura) ----
    const rSnap = await tx.get(remitoRef);
    if (!rSnap.exists()) throw new Error("REMITO_NO_EXISTE");
    const data = rSnap.data() as Remito;
    if (data.anulado) throw new Error("REMITO_YA_ANULADO");
    if (data.facturaId) throw new Error("REMITO_YA_FACTURADO");

    // Se devuelve stock según los ítems del DOCUMENTO, no según el objeto que
    // llegó por parámetro desde la pantalla (que puede estar desactualizado).
    // La transacción tiene que decidir con lo que leyó ella misma.
    const items = data.items ?? [];
    const productRefs = items.map((it) => doc(db, "products", it.productId));
    const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));

    const orderRef = data.orderId ? doc(db, "orders", data.orderId) : null;
    // Se lee el pedido dentro de la transacción para no pisar a ciegas.
    if (orderRef) await tx.get(orderRef);

    // ---- ESCRITURAS ----
    // Si la venta era "entrega directa de fábrica" no descontó stock, así que
    // tampoco se lo devolvemos al anular (sino sumaría stock que nunca salió).
    if (!data.sinStock) {
      items.forEach((it, i) => {
        const actual = (productSnaps[i].data()?.stock as number) ?? 0;
        tx.set(productRefs[i], { stock: actual + it.cantidad }, { merge: true });
      });
    }

    tx.set(
      remitoRef,
      { anulado: true, anuladoPor: anuladoPor ?? null, anuladoAt: Date.now() },
      { merge: true }
    );

    // LIBERAR EL PEDIDO. Antes esto no se hacía: el pedido quedaba con
    // `remitoId` apuntando a un remito anulado y con status "entregado", y
    // persistRemito rechaza cualquier pedido que ya tenga remitoId
    // (PEDIDO_YA_REMITIDO). Resultado: anulabas una venta mal cargada y ese
    // pedido no se podía volver a remitir NUNCA — el botón encima desaparecía
    // de la pantalla. Contradecía al propio comentario de updateRemitoMeta,
    // que manda a "anular y rehacer" para corregir una venta.
    if (orderRef) {
      tx.set(
        orderRef,
        { status: "en_proceso", remitoId: null, entregado: false },
        { merge: true }
      );
    }
  });

  logActivity("Anuló venta", {
    detalle: `${remito.numero} · ${formatARS(remito.total)}`,
    entidad: "remito",
    entidadId: remito.id,
  });
}

/**
 * Edita SOLO los datos de la venta (cliente, forma de pago, fecha). No toca
 * ítems ni stock — para cambiar productos/cantidades se usa anular + rehacer.
 */
export async function updateRemitoMeta(
  id: string,
  patch: { clienteNombre?: string; formaPago?: FormaPago; fecha?: number }
): Promise<void> {
  const data: Record<string, unknown> = {};
  if (patch.clienteNombre !== undefined)
    data.clienteNombre = patch.clienteNombre.trim() || null;
  if (patch.formaPago !== undefined) data.formaPago = patch.formaPago;
  if (patch.fecha !== undefined) data.fecha = patch.fecha;
  await updateDoc(doc(db, "remitos", id), data);
  logActivity("Editó datos de venta", { entidad: "remito", entidadId: id });
}

/**
 * DEVOLUCIÓN parcial de un remito (ej. llegó un bulto menos al cliente).
 * Atómico: DEVUELVE el stock del producto (salvo entrega de fábrica, que nunca
 * lo descontó) y registra la devolución en el remito, lo que BAJA la deuda del
 * cliente por su monto (ver totalNetoRemito en cobros.ts). `cantidad` en unidades.
 * No permite devolver más de lo que había en el remito.
 */
export async function registrarDevolucion(
  remito: Remito,
  productId: string,
  cantidadUnidades: number,
  por?: string
): Promise<void> {
  const cant = Math.floor(Number(cantidadUnidades) || 0);
  if (cant <= 0) throw new Error("CANTIDAD_INVALIDA");
  const remitoRef = doc(db, "remitos", remito.id);
  const productRef = doc(db, "products", productId);

  await runTransaction(db, async (tx) => {
    const rSnap = await tx.get(remitoRef);
    if (!rSnap.exists()) throw new Error("REMITO_NO_EXISTE");
    const data = rSnap.data() as Remito;
    if (data.anulado) throw new Error("REMITO_ANULADO");
    const item = (data.items ?? []).find((i) => i.productId === productId);
    if (!item) throw new Error("ITEM_NO_ESTA_EN_REMITO");
    const yaDevuelto = (data.devoluciones ?? [])
      .filter((d) => d.productId === productId)
      .reduce((s, d) => s + d.cantidad, 0);
    if (yaDevuelto + cant > item.cantidad) {
      throw new Error("DEVUELVE_MAS_DE_LO_VENDIDO");
    }
    const pSnap = await tx.get(productRef); // lectura antes de escribir
    const monto = Math.round(cant * item.precioVenta * 100) / 100;
    const nueva = {
      productId,
      nombre: item.nombre,
      cantidad: cant,
      monto,
      fecha: Date.now(),
      por: por ?? null,
    };
    tx.set(
      remitoRef,
      { devoluciones: [...(data.devoluciones ?? []), nueva] },
      { merge: true }
    );
    // Devuelve stock solo si la venta lo había descontado (no en entrega fábrica).
    if (!data.sinStock) {
      const actual = (pSnap.data()?.stock as number) ?? 0;
      tx.set(productRef, { stock: actual + cant }, { merge: true });
    }
  });

  logActivity("Registró devolución", {
    detalle: `${remito.numero} · devolución`,
    entidad: "remito",
    entidadId: remito.id,
  });
}

/**
 * Edita los ÍTEMS de un remito (cantidades / sacar productos) SIN anular y
 * rehacer. Atómico: ajusta el stock por la diferencia (devuelve lo que sacaste,
 * descuenta lo que agregaste — salvo entrega de fábrica), y recalcula el total y
 * los descuentos. No se puede editar un remito YA FACTURADO (para eso va una nota
 * de crédito) ni uno anulado.
 * `nuevosItems` = la lista final de ítems (con su cantidad en UNIDADES).
 */
export async function editarItemsRemito(
  remito: Remito,
  nuevosItems: RemitoItem[]
): Promise<void> {
  const remitoRef = doc(db, "remitos", remito.id);
  // Ids de todos los productos involucrados (viejos + nuevos), sin repetir.
  const ids = new Set<string>();
  (remito.items ?? []).forEach((it) => ids.add(it.productId));
  nuevosItems.forEach((it) => ids.add(it.productId));
  const idList = [...ids];
  const productRefs = idList.map((id) => doc(db, "products", id));

  await runTransaction(db, async (tx) => {
    const rSnap = await tx.get(remitoRef);
    if (!rSnap.exists()) throw new Error("REMITO_NO_EXISTE");
    const data = rSnap.data() as Remito;
    if (data.anulado) throw new Error("REMITO_ANULADO");
    if (data.facturaId) throw new Error("REMITO_YA_FACTURADO");

    const snaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));

    // Cantidades viejas y nuevas por producto (en unidades).
    const viejo = new Map<string, number>();
    (data.items ?? []).forEach((it) =>
      viejo.set(it.productId, (viejo.get(it.productId) ?? 0) + it.cantidad)
    );
    const nuevo = new Map<string, number>();
    nuevosItems.forEach((it) =>
      nuevo.set(it.productId, (nuevo.get(it.productId) ?? 0) + it.cantidad)
    );

    // Recalcular total y descuentos sobre el nuevo subtotal.
    const subtotal = nuevosItems.reduce(
      (s, it) => s + it.precioVenta * it.cantidad,
      0
    );
    let running = subtotal;
    const descuentos = (data.descuentos ?? []).map((d) => {
      const after = running * (1 - (d.pct || 0) / 100);
      const monto = Math.round((after - running) * 100) / 100;
      running = after;
      return { concepto: d.concepto, pct: d.pct, monto };
    });
    const descTotal = descuentos.reduce((s, d) => s + d.monto, 0);
    const total = Math.round((subtotal + descTotal + Number.EPSILON) * 100) / 100;

    // Escrituras: ítems + totales.
    tx.set(
      remitoRef,
      {
        items: nuevosItems,
        subtotal: Math.round(subtotal * 100) / 100,
        descuentos,
        total,
      },
      { merge: true }
    );

    // Ajuste de stock por la diferencia (salvo entrega de fábrica).
    if (!data.sinStock) {
      idList.forEach((id, i) => {
        const delta = (nuevo.get(id) ?? 0) - (viejo.get(id) ?? 0); // + = se agregó
        if (delta === 0) return;
        const actual = (snaps[i].data()?.stock as number) ?? 0;
        tx.set(productRefs[i], { stock: actual - delta }, { merge: true });
      });
    }
  });

  logActivity("Editó ítems de venta", {
    detalle: `${remito.numero}`,
    entidad: "remito",
    entidadId: remito.id,
  });
}

interface RemitoMeta {
  orderId?: string;
  origin?: Remito["origin"];
  clienteId?: string;
  clienteNombre?: string;
  clienteCuit?: string;
  clienteDireccion?: string;
  vendedorUid?: string;
  vendedorNombre?: string;
  formaPago?: FormaPago;
  /** Descuentos por condición ya calculados al cerrar la venta. */
  descuentos?: Remito["descuentos"];
  createdBy?: string;
  /**
   * Entrega directa de fábrica: la venta se factura pero NO sale del depósito de
   * ALUSO, así que NO descuenta stock. Se guarda en el remito para que anular
   * tampoco lo devuelva.
   */
  sinStock?: boolean;
}

/**
 * Crea el remito + descuenta stock + asigna nº de guía + (opcional) marca el
 * pedido como entregado, TODO en una transacción atómica:
 *  - permite stock NEGATIVO (backorder): la venta nunca se bloquea por faltante,
 *  - el nº de guía solo se consume si la operación completa OK,
 *  - si hay orderId, aborta si el pedido ya tiene remito (evita doble remito).
 */
async function persistRemito(
  items: RemitoItem[],
  meta: RemitoMeta
): Promise<Remito> {
  const subtotal = items.reduce((s, it) => s + it.precioVenta * it.cantidad, 0);
  // El total FINAL resta los descuentos por condición que llegaron ya
  // calculados. Si no hay descuentos, total === subtotal (como antes).
  const descuentos = meta.descuentos ?? [];
  const descTotal = descuentos.reduce((s, d) => s + d.monto, 0); // monto negativo
  const total = Math.round((subtotal + descTotal + Number.EPSILON) * 100) / 100;
  const now = Date.now();
  const base = {
    orderId: meta.orderId ?? null,
    origin: meta.origin ?? null,
    clienteId: meta.clienteId ?? null,
    clienteNombre: meta.clienteNombre ?? null,
    clienteCuit: meta.clienteCuit ?? null,
    clienteDireccion: meta.clienteDireccion ?? null,
    vendedorUid: meta.vendedorUid ?? null,
    vendedorNombre: meta.vendedorNombre ?? null,
    formaPago: meta.formaPago ?? "efectivo",
    items,
    subtotal: Math.round(subtotal * 100) / 100,
    descuentos,
    total,
    createdBy: meta.createdBy ?? null,
    sinStock: meta.sinStock ?? false,
    createdAt: now,
    fecha: now,
  };

  const counterRef = doc(db, "config", "counters");
  const remitoRef = doc(collection(db, "remitos"));
  const orderRef = meta.orderId ? doc(db, "orders", meta.orderId) : null;
  const productRefs = items.map((it) => doc(db, "products", it.productId));

  const numero = await runTransaction(db, async (tx) => {
    // ---- LECTURAS (todas antes de escribir) ----
    const counterSnap = await tx.get(counterRef);
    const orderSnap = orderRef ? await tx.get(orderRef) : null;
    const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));

    // ---- VALIDACIONES ----
    if (orderSnap && orderSnap.exists() && orderSnap.data()?.remitoId) {
      throw new Error("PEDIDO_YA_REMITIDO");
    }
    const stocks = productSnaps.map(
      (snap) => (snap.data()?.stock as number) ?? 0
    );
    // BACKORDER: se permite vender aunque no haya stock (queda NEGATIVO).
    // El faltante se ve en rojo en Productos y aparece en la solapa "Pedido al
    // proveedor" para reponer; cuando llega la compra, el stock se corrige solo.
    // (Antes esto tiraba STOCK_INSUFICIENTE y bloqueaba la venta.)

    const seq = ((counterSnap.data()?.remitoSeq as number) ?? 0) + 1;
    const num = `R-${String(seq).padStart(6, "0")}`;

    // ---- ESCRITURAS ----
    tx.set(counterRef, { remitoSeq: seq }, { merge: true });
    tx.set(remitoRef, { numero: num, ...base });
    // Entrega directa de fábrica: NO descontar stock (la mercadería no sale de
    // nuestro depósito). La venta y la deuda del cliente se registran igual.
    if (!meta.sinStock) {
      items.forEach((it, i) => {
        tx.set(productRefs[i], { stock: stocks[i] - it.cantidad }, { merge: true });
      });
    }
    if (orderRef) {
      tx.set(
        orderRef,
        { status: "entregado", remitoId: remitoRef.id },
        { merge: true }
      );
    }
    return num;
  });

  logActivity("Registró venta", {
    detalle: `${numero} · ${formatARS(total)}${
      meta.clienteNombre ? ` · ${meta.clienteNombre}` : ""
    }`,
    entidad: "remito",
    entidadId: remitoRef.id,
  });

  return {
    id: remitoRef.id,
    numero,
    ...base,
    clienteNombre: meta.clienteNombre,
    clienteCuit: meta.clienteCuit,
  } as Remito;
}

/**
 * Genera un remito a partir de un pedido web/vendedor (atómico: ver persistRemito).
 * `costs` = mapa productId → precioCosto (de subscribeProductCosts).
 */
export async function crearRemitoDesdePedido(
  order: Order,
  costs: Record<string, number>,
  createdBy?: string
): Promise<Remito> {
  const items: RemitoItem[] = order.items.map((it) => ({
    productId: it.productId,
    nombre: it.nombre,
    // Faltaba el código: los remitos hechos desde el POS salían con
    // "COD123 - Producto" y los hechos desde un pedido solo con el nombre.
    codigo: it.codigo,
    // Se sanea acá y no solo en la pantalla: esta función copiaba crudo lo que
    // viniera del pedido. Una cantidad negativa llegaba al descuento de stock
    // y, al restar, lo SUMABA.
    cantidad: Math.max(1, Math.floor(Number(it.cantidad) || 0)),
    precioVenta: Math.max(0, Number(it.precioVenta) || 0),
    costoUnitario: costs[it.productId] ?? 0,
  }));
  return persistRemito(items, {
    orderId: order.id,
    origin: order.origin,
    clienteNombre: order.clienteNombre,
    // El pedido ya trae el CUIT del CRM y no se propagaba: al facturar había
    // que retipearlo a mano, con riesgo de error en un comprobante fiscal.
    clienteCuit: order.clienteCuit,
    formaPago: order.formaPago,
    createdBy,
  });
}

/**
 * Punto de venta: genera un remito directo (venta en el local), sin pedido
 * previo. Descuenta stock. Es lo que se imprime y se entrega al cliente.
 */
export async function crearRemitoDirecto(input: {
  items: RemitoItem[];
  clienteId?: string;
  clienteNombre?: string;
  clienteCuit?: string;
  clienteDireccion?: string;
  vendedorUid?: string;
  vendedorNombre?: string;
  formaPago?: FormaPago;
  descuentos?: Remito["descuentos"];
  createdBy?: string;
  sinStock?: boolean;
}): Promise<Remito> {
  return persistRemito(input.items, {
    origin: "vendedor",
    clienteId: input.clienteId,
    clienteNombre: input.clienteNombre,
    clienteCuit: input.clienteCuit,
    clienteDireccion: input.clienteDireccion,
    vendedorUid: input.vendedorUid,
    vendedorNombre: input.vendedorNombre,
    formaPago: input.formaPago,
    descuentos: input.descuentos,
    createdBy: input.createdBy,
    sinStock: input.sinStock,
  });
}

export function subscribeRemitos(cb: (xs: Remito[]) => void): () => void {
  return onSnapshot(collection(db, "remitos"), (snap) => {
    cb(
      snap.docs
        .map((d) => ({ ...(d.data() as Remito), id: d.id }))
        .sort((a, b) => b.fecha - a.fecha)
    );
  });
}

/** Remitos en [start, end). Para vistas acotadas a un día/mes/año (más liviano). */
export function subscribeRemitosRange(
  start: number,
  end: number,
  cb: (xs: Remito[]) => void
): () => void {
  const q = query(
    collection(db, "remitos"),
    where("fecha", ">=", start),
    where("fecha", "<", end)
  );
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs
        .map((d) => ({ ...(d.data() as Remito), id: d.id }))
        .sort((a, b) => b.fecha - a.fecha)
    );
  });
}

/**
 * Modo de despacho del pedido: "palletizado" (se arma en pallet) o "granel"
 * (suelto, para fletes chicos). Se elige en Envíos → Pendientes de despacho.
 */
export async function setModoDespacho(
  remitoId: string,
  modo: "palletizado" | "granel"
): Promise<void> {
  await updateDoc(doc(db, "remitos", remitoId), { modoDespacho: modo });
}

/**
 * Marca un remito como COBRADO en la fecha indicada (por defecto, ahora). La
 * `fechaCobro` define en qué mes cae la comisión del vendedor. Ver lib/cobros.
 */
export async function marcarCobrado(
  remito: Remito,
  cobradoPor?: string,
  fechaCobro?: number
): Promise<void> {
  const fecha = fechaCobro ?? Date.now();
  await updateDoc(doc(db, "remitos", remito.id), {
    cobrado: true,
    fechaCobro: fecha,
    cobradoPor: cobradoPor ?? null,
  });
  logActivity("Registró cobro", {
    detalle: `${remito.numero} · ${formatARS(remito.total)}${
      remito.clienteNombre ? ` · ${remito.clienteNombre}` : ""
    }`,
    entidad: "remito",
    entidadId: remito.id,
  });
}

/** Revierte un cobro (se marcó por error): el remito vuelve a ser deuda. */
export async function desmarcarCobrado(remito: Remito): Promise<void> {
  await updateDoc(doc(db, "remitos", remito.id), {
    cobrado: false,
    fechaCobro: null,
    cobradoPor: null,
  });
  logActivity("Revirtió cobro", {
    detalle: `${remito.numero} · ${formatARS(remito.total)}`,
    entidad: "remito",
    entidadId: remito.id,
  });
}

/**
 * Remitos COBRADOS cuya plata entró en [start, end). Para la comisión "según
 * cobro": el vendedor cobra sobre lo que se cobró en el período, no sobre lo
 * que vendió. La fecha que manda es `fechaCobro`, no `fecha`.
 */
export function subscribeRemitosCobradosRange(
  start: number,
  end: number,
  cb: (xs: Remito[]) => void
): () => void {
  const q = query(
    collection(db, "remitos"),
    where("fechaCobro", ">=", start),
    where("fechaCobro", "<", end)
  );
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs
        .map((d) => ({ ...(d.data() as Remito), id: d.id }))
        .sort((a, b) => (b.fechaCobro ?? 0) - (a.fechaCobro ?? 0))
    );
  });
}

/*
 * NO agregues acá una `crearFactura()` que escriba en `facturas` desde el
 * cliente. Existió una y era una bomba: creaba la factura SIN CAE y le ponía el
 * `facturaId` al remito, con lo cual la Cloud Function `emitirFactura` (la que
 * habla con AFIP de verdad) veía el remito como "ya facturado" y ese remito no
 * se podía facturar NUNCA MÁS. La factura fiscal la emite SOLO la función.
 */

export function subscribeFacturas(cb: (xs: Factura[]) => void): () => void {
  return onSnapshot(collection(db, "facturas"), (snap) => {
    cb(
      snap.docs
        .map((d) => ({ ...(d.data() as Factura), id: d.id }))
        .sort((a, b) => b.fecha - a.fecha)
    );
  });
}
