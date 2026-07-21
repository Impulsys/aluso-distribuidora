// Cuentas Corrientes: proveedores, compras (deudas A/B) y pagos.
// Escritura solo superadmin; lectura socio/superadmin (ver firestore.rules).
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { logActivity } from "./bitacora";
import { formatARS } from "./format";
import {
  PROVEEDORES,
  type Proveedor,
  type Purchase,
  type SupplierPayment,
} from "./types";

// Firestore rechaza undefined → lo quitamos antes de escribir.
function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

// ==================== PROVEEDORES ====================
export interface NewProveedorInput {
  nombre: string;
  cuit?: string;
  contacto?: string;
  notas?: string;
}

export function subscribeProveedores(
  cb: (xs: Proveedor[]) => void
): () => void {
  return onSnapshot(collection(db, "proveedores"), (snap) => {
    cb(
      snap.docs
        .map((d) => ({ ...(d.data() as Proveedor), id: d.id }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
    );
  });
}

export async function createProveedor(
  input: NewProveedorInput
): Promise<string> {
  const ref = await addDoc(
    collection(db, "proveedores"),
    clean({ ...input, createdAt: Date.now() })
  );
  logActivity("Creó proveedor", {
    detalle: input.nombre,
    entidad: "proveedor",
    entidadId: ref.id,
  });
  return ref.id;
}


export async function deleteProveedor(id: string): Promise<void> {
  await deleteDoc(doc(db, "proveedores", id));
  logActivity("Eliminó proveedor", { entidad: "proveedor", entidadId: id });
}

/**
 * Carga los proveedores semilla (PROVEEDORES) una sola vez si la colección
 * está vacía, para no romper el dropdown del camión en una BD nueva.
 */
export async function seedProveedoresIfEmpty(): Promise<void> {
  const snap = await getDocs(collection(db, "proveedores"));
  if (!snap.empty) return;
  await Promise.all(
    PROVEEDORES.map((nombre) =>
      addDoc(collection(db, "proveedores"), { nombre, createdAt: Date.now() })
    )
  );
}

// ==================== COMPRAS (deudas) ====================
export interface NewPurchaseInput {
  proveedorId: string;
  proveedorNombre: string;
  modalidad: Purchase["modalidad"];
  numero: string;
  monto: number;
  fecha: number;
  camionId?: string;
  camionNombre?: string;
  createdBy?: string;
}

export function subscribePurchases(
  cb: (xs: Purchase[]) => void
): () => void {
  return onSnapshot(collection(db, "purchases"), (snap) => {
    cb(
      snap.docs
        .map((d) => ({ ...(d.data() as Purchase), id: d.id }))
        .sort((a, b) => b.fecha - a.fecha)
    );
  });
}

export async function createPurchase(
  input: NewPurchaseInput
): Promise<string> {
  const ref = await addDoc(
    collection(db, "purchases"),
    clean({ ...input, createdAt: Date.now() })
  );
  logActivity("Registró compra a proveedor", {
    detalle: `${input.proveedorNombre} · ${formatARS(input.monto)} (${input.modalidad})`,
    entidad: "compra",
    entidadId: ref.id,
  });
  return ref.id;
}

export async function deletePurchase(id: string): Promise<void> {
  await deleteDoc(doc(db, "purchases", id));
  logActivity("Eliminó compra a proveedor", {
    entidad: "compra",
    entidadId: id,
  });
}

// ==================== PAGOS ====================
export interface NewPaymentInput {
  proveedorId: string;
  monto: number;
  fecha: number;
  formaPago?: SupplierPayment["formaPago"];
  purchaseId?: string; // imputado a una compra; ausente = a cuenta
  modalidad?: SupplierPayment["modalidad"];
  via?: SupplierPayment["via"];
  comisionPct?: number;
  comisionMonto?: number;
  arqueoDeposito?: Record<string, number>;
  transferNumero?: string;
  transferBanco?: string;
  transferTitular?: string;
  depositoCuenta?: string;
  depositoTitular?: string;
  desdeCaja?: boolean;
  notas?: string;
  createdBy?: string;
}

export function subscribeSupplierPayments(
  cb: (xs: SupplierPayment[]) => void
): () => void {
  return onSnapshot(collection(db, "supplierPayments"), (snap) => {
    cb(
      snap.docs
        .map((d) => ({ ...(d.data() as SupplierPayment), id: d.id }))
        // Por fecha (desc) y, dentro del mismo día, por orden de carga.
        .sort((a, b) => b.fecha - a.fecha || (b.createdAt ?? 0) - (a.createdAt ?? 0))
    );
  });
}

/** Pagos en [start, end). Para vistas acotadas a un día/mes (más liviano). */
export function subscribeSupplierPaymentsRange(
  start: number,
  end: number,
  cb: (xs: SupplierPayment[]) => void
): () => void {
  const q = query(
    collection(db, "supplierPayments"),
    where("fecha", ">=", start),
    where("fecha", "<", end)
  );
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs
        .map((d) => ({ ...(d.data() as SupplierPayment), id: d.id }))
        .sort((a, b) => b.fecha - a.fecha || (b.createdAt ?? 0) - (a.createdAt ?? 0))
    );
  });
}

export async function createPayment(input: NewPaymentInput): Promise<string> {
  const ref = await addDoc(
    collection(db, "supplierPayments"),
    clean({ ...input, createdAt: Date.now() })
  );
  logActivity("Registró pago a proveedor", {
    detalle: `${formatARS(input.monto)}${input.via ? ` · ${input.via}` : ""}`,
    entidad: "pago",
    entidadId: ref.id,
  });
  return ref.id;
}

export async function updatePayment(
  id: string,
  // purchaseId puede ser null para "des-imputar" (pago a cuenta).
  patch: Partial<Omit<NewPaymentInput, "purchaseId">> & {
    purchaseId?: string | null;
  }
): Promise<void> {
  await updateDoc(doc(db, "supplierPayments", id), clean(patch));
  logActivity("Editó pago a proveedor", { entidad: "pago", entidadId: id });
}

export async function deletePayment(id: string): Promise<void> {
  await deleteDoc(doc(db, "supplierPayments", id));
  logActivity("Eliminó pago a proveedor", { entidad: "pago", entidadId: id });
}

// ==================== HELPERS DE SALDO ====================
const sum = (xs: { monto: number }[]) => xs.reduce((s, x) => s + (x.monto || 0), 0);

/** Deuda de un proveedor = comprado − pagado (incluye pagos a cuenta y a factura). */
export function saldoProveedor(
  proveedorId: string,
  purchases: Purchase[],
  payments: SupplierPayment[]
): { comprado: number; pagado: number; deuda: number } {
  const comprado = sum(purchases.filter((p) => p.proveedorId === proveedorId));
  const pagado = sum(payments.filter((p) => p.proveedorId === proveedorId));
  return { comprado, pagado, deuda: comprado - pagado };
}

/** Saldo de una compra puntual = monto − pagos imputados a esa compra. */
export function saldoCompra(
  compra: Purchase,
  payments: SupplierPayment[]
): number {
  const pagado = sum(payments.filter((p) => p.purchaseId === compra.id));
  return compra.monto - pagado;
}

/**
 * Deuda global a todos los proveedores: suma de las deudas POSITIVAS de cada uno.
 *
 * Antes era `sum(compras) − sum(pagos)`, y eso mentía: si a un proveedor le
 * pagaste de más (saldo a favor), ese crédito tapaba la deuda de OTRO proveedor
 * y el total daba menos de lo que realmente se debe. La plata a favor en A no
 * paga lo que se le debe a B.
 */
export function deudaGlobal(
  purchases: Purchase[],
  payments: SupplierPayment[]
): number {
  const porProveedor: Record<string, number> = {};
  for (const p of purchases) {
    porProveedor[p.proveedorId] =
      (porProveedor[p.proveedorId] ?? 0) + (p.monto || 0);
  }
  for (const p of payments) {
    porProveedor[p.proveedorId] =
      (porProveedor[p.proveedorId] ?? 0) - (p.monto || 0);
  }
  return Object.values(porProveedor).reduce((s, deuda) => s + Math.max(0, deuda), 0);
}

