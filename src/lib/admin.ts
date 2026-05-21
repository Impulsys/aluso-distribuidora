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

// ==================== PRODUCTOS (overrides públicos) ====================
// Solo guardamos los campos editables que pueden ser PÚBLICOS — el resto
// (id, ean, marca, nombre, descripcion, imagen, categoria) viene del seed.
// IMPORTANTE: precioCosto NO va acá — va en productCosts/ (admin-only).
export type ProductOverride = Partial<
  Pick<
    Product,
    | "precioVenta"
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

// Suscripción en tiempo real al override público.
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

// ==================== PRODUCT COSTS (admin-only) ====================
// Precio costo separado para que no sea legible por clientes anónimos.
export async function setProductCost(
  id: string,
  precioCosto: number
): Promise<void> {
  await setDoc(
    doc(db, "productCosts", id),
    { precioCosto, updatedAt: Date.now() },
    { merge: true }
  );
}

export function subscribeProductCosts(
  cb: (costs: Record<string, number>) => void
): () => void {
  return onSnapshot(collection(db, "productCosts"), (snap) => {
    const map: Record<string, number> = {};
    snap.docs.forEach((d) => {
      const data = d.data() as { precioCosto?: number };
      if (typeof data.precioCosto === "number") map[d.id] = data.precioCosto;
    });
    cb(map);
  });
}
