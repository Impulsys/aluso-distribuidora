import {
  collection,
  addDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  where,
  limit,
  getDocs,
} from "firebase/firestore";
import { db } from "./firebase";
import { logActivity } from "./bitacora";
import { findTruckForDay } from "./trucks";
import type {
  CartItem,
  FormaPago,
  Order,
  OrderOrigin,
  Truck,
} from "./types";

export interface CreateOrderInput {
  origin: OrderOrigin;
  createdBy: string;
  createdByName: string;
  createdByRole?: Order["createdByRole"];
  items: CartItem[];
  total: number;
  clienteNombre?: string;
  clienteTelefono?: string;
  clienteId?: string;
  clienteCuit?: string;
  clienteRazonSocial?: string;
  clienteCondicionIva?: Order["clienteCondicionIva"];
  clienteDireccion?: string;
  fechaEntrega?: number;
  horarioEntrega?: string;
  notas?: string;
  formaPago?: FormaPago;
}

export async function createOrder(input: CreateOrderInput): Promise<string> {
  const now = Date.now();

  // Auto-asignar al camión activo del momento (si hay y si tenemos permiso).
  // Las reglas solo dejan leer 'trucks' a socio/superadmin; un vendedor no
  // puede. Si la lectura falla, seguimos sin asignar camión en lugar de
  // romper el alta del pedido.
  let truckId: string | null = null;
  try {
    const trucksSnap = await getDocs(query(collection(db, "trucks"), limit(50)));
    const trucks = trucksSnap.docs
      .map((d) => ({ ...(d.data() as Truck), id: d.id }))
      .sort((a, b) => b.fechaIngreso - a.fechaIngreso);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    truckId = findTruckForDay(trucks, today.getTime())?.id ?? null;
  } catch (e) {
    console.warn("No se pudo asignar camión al pedido:", e);
  }

  // Firestore rechaza valores undefined → quitamos los opcionales vacíos.
  const payload: Record<string, unknown> = {
    ...input,
    truckId,
    status: "nuevo",
    createdAt: now,
  };
  for (const k of Object.keys(payload)) {
    if (payload[k] === undefined) delete payload[k];
  }

  const docRef = await addDoc(collection(db, "orders"), payload);
  return docRef.id;
}

export async function getOrdersByVendedor(
  uid: string,
  max = 50
): Promise<Order[]> {
  // Sin orderBy en la query (evita necesidad de índice compuesto):
  // sortamos del lado cliente.
  const q = query(
    collection(db, "orders"),
    where("createdBy", "==", uid),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Order))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getAllOrders(max = 100): Promise<Order[]> {
  const q = query(collection(db, "orders"), limit(max));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Order))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Pedidos con entrega agendada en [start, end). Para la sección Entregas. */
export function subscribeOrdersByEntrega(
  start: number,
  end: number,
  cb: (xs: Order[]) => void
): () => void {
  const q = query(
    collection(db, "orders"),
    where("fechaEntrega", ">=", start),
    where("fechaEntrega", "<", end)
  );
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Order))
        .sort((a, b) => (a.horarioEntrega ?? "").localeCompare(b.horarioEntrega ?? ""))
    );
  });
}

/** Marca/desmarca un pedido como entregado. */
export async function setOrderEntregado(
  id: string,
  entregado: boolean
): Promise<void> {
  await updateDoc(doc(db, "orders", id), {
    entregado,
    fechaEntregado: entregado ? Date.now() : null,
  });
  logActivity(entregado ? "Marcó entrega" : "Desmarcó entrega", {
    entidad: "pedido",
    entidadId: id,
  });
}
