import {
  collection,
  addDoc,
  query,
  where,
  limit,
  getDocs,
} from "firebase/firestore";
import { db } from "./firebase";
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
  items: CartItem[];
  total: number;
  clienteNombre?: string;
  clienteTelefono?: string;
  notas?: string;
  formaPago?: FormaPago;
}

export async function createOrder(input: CreateOrderInput): Promise<string> {
  // Auto-asignar al camión activo del momento (si hay)
  const trucksSnap = await getDocs(
    query(collection(db, "trucks"), limit(50))
  );
  const trucks = trucksSnap.docs
    .map((d) => ({ ...(d.data() as Truck), id: d.id }))
    .sort((a, b) => b.fechaIngreso - a.fechaIngreso);
  const now = Date.now();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const activeTruck = findTruckForDay(trucks, today.getTime());

  const docRef = await addDoc(collection(db, "orders"), {
    ...input,
    truckId: activeTruck?.id ?? null,
    status: "nuevo",
    createdAt: now,
  });
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
