// Ventas: Remitos (descuentan stock) y Facturas (no tocan stock).
// Escritura solo superadmin; lectura socio/superadmin (ver firestore.rules).
import {
  collection,
  doc,
  onSnapshot,
  getDocs,
  query,
  where,
  limit,
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
  TipoFactura,
} from "./types";

const IVA_RATE = 0.21;

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
  const productRefs = remito.items.map((it) => doc(db, "products", it.productId));

  await runTransaction(db, async (tx) => {
    const rSnap = await tx.get(remitoRef);
    if (!rSnap.exists()) throw new Error("REMITO_NO_EXISTE");
    const data = rSnap.data() as Remito;
    if (data.anulado) throw new Error("REMITO_YA_ANULADO");
    if (data.facturaId) throw new Error("REMITO_YA_FACTURADO");

    const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));

    // Devolver stock de cada ítem
    remito.items.forEach((it, i) => {
      const actual = (productSnaps[i].data()?.stock as number) ?? 0;
      tx.set(productRefs[i], { stock: actual + it.cantidad }, { merge: true });
    });
    // Marcar anulado
    tx.set(
      remitoRef,
      { anulado: true, anuladoPor: anuladoPor ?? null, anuladoAt: Date.now() },
      { merge: true }
    );
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

interface RemitoMeta {
  orderId?: string;
  origin?: Remito["origin"];
  clienteNombre?: string;
  clienteCuit?: string;
  formaPago?: FormaPago;
  createdBy?: string;
}

/**
 * Crea el remito + descuenta stock + asigna nº de guía + (opcional) marca el
 * pedido como entregado, TODO en una transacción atómica:
 *  - valida que haya stock suficiente (no permite negativo),
 *  - el nº de guía solo se consume si la operación completa OK,
 *  - si hay orderId, aborta si el pedido ya tiene remito (evita doble remito).
 */
async function persistRemito(
  items: RemitoItem[],
  meta: RemitoMeta
): Promise<Remito> {
  const total = items.reduce((s, it) => s + it.precioVenta * it.cantidad, 0);
  const now = Date.now();
  const base = {
    orderId: meta.orderId ?? null,
    origin: meta.origin ?? null,
    clienteNombre: meta.clienteNombre ?? null,
    clienteCuit: meta.clienteCuit ?? null,
    formaPago: meta.formaPago ?? "efectivo",
    items,
    total,
    createdBy: meta.createdBy ?? null,
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
    items.forEach((it, i) => {
      if (stocks[i] < it.cantidad) {
        throw new Error(`STOCK_INSUFICIENTE|${it.nombre}|${stocks[i]}`);
      }
    });

    const seq = ((counterSnap.data()?.remitoSeq as number) ?? 0) + 1;
    const num = `R-${String(seq).padStart(6, "0")}`;

    // ---- ESCRITURAS ----
    tx.set(counterRef, { remitoSeq: seq }, { merge: true });
    tx.set(remitoRef, { numero: num, ...base });
    items.forEach((it, i) => {
      tx.set(productRefs[i], { stock: stocks[i] - it.cantidad }, { merge: true });
    });
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
    cantidad: it.cantidad,
    precioVenta: it.precioVenta,
    costoUnitario: costs[it.productId] ?? 0,
  }));
  return persistRemito(items, {
    orderId: order.id,
    origin: order.origin,
    clienteNombre: order.clienteNombre,
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
  clienteNombre?: string;
  formaPago?: FormaPago;
  createdBy?: string;
}): Promise<Remito> {
  return persistRemito(input.items, {
    origin: "vendedor",
    clienteNombre: input.clienteNombre,
    formaPago: input.formaPago,
    createdBy: input.createdBy,
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

export async function getRemitoByNumero(
  numero: string
): Promise<Remito | null> {
  const q = query(
    collection(db, "remitos"),
    where("numero", "==", numero.trim()),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { ...(d.data() as Remito), id: d.id };
}

export interface CrearFacturaInput {
  remito: Remito;
  tipo: TipoFactura;
  consumidorFinal: boolean;
  cuit?: string;
  razonSocial?: string;
  createdBy?: string;
}

/**
 * Crea la factura (comprobante). NO toca stock. Transacción anti-doble
 * facturación: aborta si el remito ya tiene factura. AFIP/CAE es etapa B.
 */
export async function crearFactura(input: CrearFacturaInput): Promise<string> {
  const { remito, tipo } = input;
  const total = remito.total;
  // En A el IVA se discrimina; en B/C va incluido (no discriminado).
  const neto = tipo === "A" ? total / (1 + IVA_RATE) : total;
  const iva = tipo === "A" ? total - neto : 0;
  const now = Date.now();

  const data = {
    remitoId: remito.id,
    remitoNumero: remito.numero,
    tipo,
    consumidorFinal: input.consumidorFinal,
    cuit: input.cuit?.trim() || null,
    razonSocial: input.razonSocial?.trim() || null,
    items: remito.items,
    neto,
    iva,
    total,
    cae: null,
    caeVto: null,
    estado: "interna" as Factura["estado"],
    createdBy: input.createdBy ?? null,
    createdAt: now,
    fecha: now,
  };

  const remitoRef = doc(db, "remitos", remito.id);
  const facturaRef = doc(collection(db, "facturas"));

  await runTransaction(db, async (tx) => {
    const rSnap = await tx.get(remitoRef);
    if (!rSnap.exists()) throw new Error("REMITO_NO_EXISTE");
    if (rSnap.data()?.facturaId) throw new Error("REMITO_YA_FACTURADO");
    tx.set(facturaRef, data);
    tx.set(remitoRef, { facturaId: facturaRef.id }, { merge: true });
  });

  logActivity("Generó factura", {
    detalle: `Factura ${tipo} · ${remito.numero} · ${formatARS(total)}`,
    entidad: "factura",
    entidadId: facturaRef.id,
  });

  return facturaRef.id;
}

export function subscribeFacturas(cb: (xs: Factura[]) => void): () => void {
  return onSnapshot(collection(db, "facturas"), (snap) => {
    cb(
      snap.docs
        .map((d) => ({ ...(d.data() as Factura), id: d.id }))
        .sort((a, b) => b.fecha - a.fecha)
    );
  });
}
