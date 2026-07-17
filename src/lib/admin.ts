import {
  collection,
  doc,
  addDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  increment,
  getDoc,
  runTransaction,
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
  // Si tocan el STOCK a mano, leemos el valor previo ANTES de pisarlo: el
  // registro tiene que decir de cuánto a cuánto, no solo que "editaron algo".
  let stockAntes: number | null = null;
  if (typeof patch.stock === "number") {
    const prev = await getDoc(doc(db, "products", id));
    stockAntes = (prev.data()?.stock as number) ?? 0;
  }

  await setDoc(doc(db, "products", id), patch, { merge: true });

  // No registrar el borrado lógico acá (deleteProduct ya lo loguea).
  if (!("eliminado" in patch)) {
    if (stockAntes !== null && stockAntes !== patch.stock) {
      const delta = (patch.stock as number) - stockAntes;
      logActivity("Ajustó stock a mano", {
        detalle:
          `${patch.nombre ?? id} · ${stockAntes} → ${patch.stock} ` +
          `(${delta > 0 ? "+" : ""}${delta})`,
        entidad: "producto",
        entidadId: id,
      });
    }
    const otros = Object.keys(patch).filter((k) => k !== "stock");
    if (otros.length === 0) return;
    logActivity("Editó producto", {
      detalle: patch.nombre
        ? `${patch.nombre} (${otros.join(", ")})`
        : otros.join(", "),
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
    // OJO: stock y precioVenta van SIN default. Si acá pusiéramos `?? 0`, al
    // "crear" un producto cuyo EAN YA EXISTE (ej. recepción de mercadería), el
    // merge le pisaba el stock y el precio con 0 y se perdía todo.
    precioVenta: input.precioVenta,
    descripcion: input.descripcion || undefined,
    imagen:
      input.imagen ||
      "https://placehold.co/600x600/006081/ffffff?text=Producto",
    stock: input.stock,
    activo: true,
    // Si el EAN coincide con un producto borrado, al recrearlo lo "revivimos"
    // (sin esto, el merge mantenía eliminado:true y el producto quedaba oculto).
    eliminado: false,
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

/**
 * Suma (o resta) unidades al stock y lo DEJA ASENTADO en la bitácora con el
 * antes y el después.
 *
 * Va en transacción (y no con `increment()`) justamente para poder leer el valor
 * previo: sin eso el registro diría "sumó 50" pero no desde cuánto, que es el
 * dato que sirve para controlar. La transacción sigue siendo atómica.
 *
 * @param motivo de dónde viene el movimiento (recepción, camión, ajuste…).
 */
export async function incrementStock(
  id: string,
  delta: number,
  motivo?: string
): Promise<void> {
  const ref = doc(db, "products", id);
  const res = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const antes = (snap.data()?.stock as number) ?? 0;
    const despues = antes + delta;
    tx.set(ref, { stock: despues }, { merge: true });
    return { antes, despues, nombre: (snap.data()?.nombre as string) ?? id };
  });

  logActivity(delta >= 0 ? "Sumó stock" : "Descontó stock", {
    detalle:
      `${res.nombre} · ${res.antes} → ${res.despues} ` +
      `(${delta > 0 ? "+" : ""}${delta})` +
      (motivo ? ` · ${motivo}` : ""),
    entidad: "producto",
    entidadId: id,
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
