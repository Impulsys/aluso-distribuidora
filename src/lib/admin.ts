import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  query,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";
import type { AppUser, Order, OrderStatus, Product, Role } from "./types";

// ==================== USUARIOS ====================
export async function getAllUsers(): Promise<AppUser[]> {
  const snap = await getDocs(query(collection(db, "users"), limit(200)));
  return snap.docs
    .map((d) => d.data() as AppUser)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export async function updateUserRole(uid: string, role: Role): Promise<void> {
  await updateDoc(doc(db, "users", uid), { role });
}

// ==================== PEDIDOS ====================
export async function updateOrderStatus(
  id: string,
  status: OrderStatus
): Promise<void> {
  await updateDoc(doc(db, "orders", id), { status });
}

// ==================== PRODUCTOS (overrides) ====================
// Solo guardamos los campos editables — el resto (id, ean, marca, nombre,
// descripcion, imagen, categoria) viene del seed estático.
export type ProductOverride = Partial<
  Pick<
    Product,
    | "precioVenta"
    | "precioCosto"
    | "stock"
    | "activo"
    | "destacado"
    | "precioOferta"
  >
>;

export async function setProductOverride(
  id: string,
  patch: ProductOverride
): Promise<void> {
  await setDoc(doc(db, "products", id), patch, { merge: true });
}

// Suscripción en tiempo real (admin y catálogo público lo usan).
export function subscribeProductOverrides(
  cb: (overrides: Record<string, ProductOverride>) => void
): () => void {
  return onSnapshot(collection(db, "products"), (snap) => {
    const map: Record<string, ProductOverride> = {};
    snap.docs.forEach((d) => {
      map[d.id] = d.data() as ProductOverride;
    });
    cb(map);
  });
}
