import {
  collection,
  addDoc,
  query,
  where,
  limit,
  getDocs,
} from "firebase/firestore";
import { db } from "./firebase";
import type { CartItem, Order, OrderOrigin } from "./types";

export interface CreateOrderInput {
  origin: OrderOrigin;
  createdBy: string;
  createdByName: string;
  items: CartItem[];
  total: number;
  clienteNombre?: string;
  clienteTelefono?: string;
  notas?: string;
}

export async function createOrder(input: CreateOrderInput): Promise<string> {
  const docRef = await addDoc(collection(db, "orders"), {
    ...input,
    status: "nuevo",
    createdAt: Date.now(),
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
