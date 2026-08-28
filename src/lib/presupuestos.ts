// Presupuestos: ventas que el cliente todavía evalúa. NO mueven stock ni son
// comprobante. Se guardan con los precios netos del cliente y, cuando vuelve
// con el N°, se cargan en el POS para convertirlos en venta (remito).
// Escritura solo superadmin; lectura socio/superadmin (ver firestore.rules).
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { logActivity } from "./bitacora";
import { formatARS } from "./format";
import type { FormaPago, Presupuesto, RemitoItem } from "./types";

export interface NuevoPresupuesto {
  clienteId?: string;
  clienteNombre?: string;
  clienteCuit?: string;
  vendedorUid?: string;
  vendedorNombre?: string;
  formaPago?: FormaPago;
  items: RemitoItem[];
  descuentos?: { concepto: string; pct: number; monto: number }[];
  createdBy?: string;
}

/**
 * Crea un presupuesto con numeración P-000001. NO toca stock. El número se
 * consume del mismo doc de contadores que los remitos (campo presupuestoSeq),
 * en transacción para que dos cargas simultáneas no repitan número.
 */
export async function crearPresupuesto(
  input: NuevoPresupuesto
): Promise<Presupuesto> {
  const subtotal = input.items.reduce(
    (s, it) => s + it.precioVenta * it.cantidad,
    0
  );
  const descuentos = input.descuentos ?? [];
  const descTotal = descuentos.reduce((s, d) => s + d.monto, 0); // negativo
  const total = Math.round((subtotal + descTotal + Number.EPSILON) * 100) / 100;
  const now = Date.now();

  const counterRef = doc(db, "config", "counters");
  const numero = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const seq = ((snap.data()?.presupuestoSeq as number) ?? 0) + 1;
    tx.set(counterRef, { presupuestoSeq: seq }, { merge: true });
    return `P-${String(seq).padStart(6, "0")}`;
  });

  const base = {
    numero,
    clienteId: input.clienteId ?? null,
    clienteNombre: input.clienteNombre ?? null,
    clienteCuit: input.clienteCuit ?? null,
    vendedorUid: input.vendedorUid ?? null,
    vendedorNombre: input.vendedorNombre ?? null,
    formaPago: input.formaPago ?? null,
    items: input.items,
    subtotal: Math.round(subtotal * 100) / 100,
    descuentos,
    total,
    estado: "pendiente" as const,
    createdBy: input.createdBy ?? null,
    createdAt: now,
    fecha: now,
  };
  const ref = await addDoc(collection(db, "presupuestos"), base);

  logActivity("Generó presupuesto", {
    detalle: `${numero} · ${formatARS(total)}${
      input.clienteNombre ? ` · ${input.clienteNombre}` : ""
    }`,
    entidad: "presupuesto",
    entidadId: ref.id,
  });

  return { id: ref.id, ...base } as Presupuesto;
}

export function subscribePresupuestos(
  cb: (xs: Presupuesto[]) => void
): () => void {
  const q = query(
    collection(db, "presupuestos"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Presupuesto));
  });
}

/** Busca un presupuesto por su número (ej "P-000001" o "1"). null si no existe. */
export async function buscarPresupuestoPorNumero(
  numeroRaw: string
): Promise<Presupuesto | null> {
  const t = numeroRaw.trim().toUpperCase();
  // Acepta "P-000001", "P000001", "000001" o "1".
  const soloNum = t.replace(/[^0-9]/g, "");
  const numero = soloNum ? `P-${soloNum.padStart(6, "0")}` : t;
  const q = query(
    collection(db, "presupuestos"),
    where("numero", "==", numero)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Presupuesto;
}

/** Marca el presupuesto como convertido en venta (guarda el remito generado). */
export async function marcarPresupuestoConvertido(
  id: string,
  remitoId: string
): Promise<void> {
  await updateDoc(doc(db, "presupuestos", id), {
    estado: "convertido",
    remitoId,
  });
}
