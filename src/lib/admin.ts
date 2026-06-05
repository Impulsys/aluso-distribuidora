import {
  collection,
  doc,
  addDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  increment,
  query,
  limit,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";
import { logActivity } from "./bitacora";
import { ROLE_LABELS } from "./types";
import type { AppUser, Marca, Order, OrderStatus, Product, Role } from "./types";

/** Sube una foto de producto a Storage y devuelve la URL pública. */
export async function uploadProductImage(
  id: string,
  file: File
): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const r = ref(storage, `productos/${id}-${Date.now()}.${ext}`);
  await uploadBytes(r, file);
  return getDownloadURL(r);
}

// ==================== USUARIOS ====================
export async function getAllUsers(): Promise<AppUser[]> {
  const snap = await getDocs(query(collection(db, "users"), limit(200)));
  return snap.docs
    .map((d) => d.data() as AppUser)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export async function updateUserRole(uid: string, role: Role): Promise<void> {
  await updateDoc(doc(db, "users", uid), { role });
  logActivity("Cambió rol de usuario", {
    detalle: `→ ${ROLE_LABELS[role]}`,
    entidad: "usuario",
    entidadId: uid,
  });
}

// ==================== PEDIDOS ====================
export async function updateOrderStatus(
  id: string,
  status: OrderStatus
): Promise<void> {
  await updateDoc(doc(db, "orders", id), { status });
}

// ==================== PRODUCTOS (overrides públicos) ====================
// Campos editables (públicos) que se guardan como override sobre el seed.
// IMPORTANTE: precioCosto NO va acá — va en productCosts/ (admin-only).
export type ProductOverride = Partial<
  Pick<
    Product,
    | "precioVenta"
    | "stock"
    | "activo"
    | "destacado"
    | "precioOferta"
    | "descripcion"
    | "nombre"
    | "imagen"
    | "categoria"
    | "marca"
    | "codigo"
    | "ean"
    | "eliminado"
  >
>;

export async function setProductOverride(
  id: string,
  patch: ProductOverride
): Promise<void> {
  await setDoc(doc(db, "products", id), patch, { merge: true });
  // No registrar el borrado lógico acá (deleteProduct ya lo loguea).
  if (!("eliminado" in patch)) {
    logActivity("Editó producto", {
      detalle: patch.nombre
        ? `${patch.nombre} (${Object.keys(patch).join(", ")})`
        : Object.keys(patch).join(", "),
      entidad: "producto",
      entidadId: id,
    });
  }
}

/**
 * Borrado lógico de un producto (sirve para los del seed y para los nuevos):
 * marca eliminado=true; useProducts lo oculta del catálogo y del admin.
 */
export async function deleteProduct(id: string): Promise<void> {
  await setDoc(
    doc(db, "products", id),
    { eliminado: true, activo: false },
    { merge: true }
  );
  logActivity("Eliminó producto", { entidad: "producto", entidadId: id });
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

// ==================== ALTA DE PRODUCTOS NUEVOS ====================
// Los productos del seed viven en código; los NUEVOS viven enteros en
// Firestore (products/{id}). useProducts mezcla ambos.
export interface NewProductInput {
  nombre: string;
  marca: Marca;
  ean?: string;
  codigo?: string;
  categoria?: string;
  precioVenta?: number;
  descripcion?: string;
  imagen?: string;
  stock?: number;
}

export async function createProduct(input: NewProductInput): Promise<string> {
  const data = {
    nombre: input.nombre,
    marca: input.marca,
    ean: input.ean || undefined,
    codigo: input.codigo || undefined,
    categoria: input.categoria || "General",
    precioVenta: input.precioVenta ?? 0,
    descripcion: input.descripcion || "",
    imagen:
      input.imagen ||
      "https://placehold.co/600x600/006081/ffffff?text=Producto",
    stock: input.stock ?? 0,
    activo: true,
  };
  // Quitar undefined (Firestore los rechaza)
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );
  if (input.ean) {
    // id = EAN para escaneo directo
    await setDoc(doc(db, "products", input.ean), clean, { merge: true });
    logActivity("Creó producto", {
      detalle: input.nombre,
      entidad: "producto",
      entidadId: input.ean,
    });
    return input.ean;
  }
  const ref = await addDoc(collection(db, "products"), clean);
  logActivity("Creó producto", {
    detalle: input.nombre,
    entidad: "producto",
    entidadId: ref.id,
  });
  return ref.id;
}

/** Suma (o resta) unidades al stock de un producto de forma atómica. */
export async function incrementStock(id: string, delta: number): Promise<void> {
  await setDoc(
    doc(db, "products", id),
    { stock: increment(delta) },
    { merge: true }
  );
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
  logActivity("Cambió costo de producto", {
    entidad: "producto",
    entidadId: id,
  });
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
