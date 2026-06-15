// Clientes (CRM simple). Lo usan vendedores y socios. Lectura/escritura
// vendedor+ (ver firestore.rules). Se registran en la bitácora.
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import { logActivity } from "./bitacora";
import type { Cliente } from "./types";

export interface NewClienteInput {
  nombre: string;
  razonSocial?: string;
  cuit?: string;
  condicionIva?: Cliente["condicionIva"];
  email?: string;
  telefono?: string;
  direccionEntrega?: string;
  domicilioFiscal?: string;
  vendedorId?: string;
  vendedorNombre?: string;
}

// Firestore rechaza undefined → lo quitamos antes de escribir.
function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== "") out[k] = v;
  }
  return out as Partial<T>;
}

export function subscribeClientes(cb: (xs: Cliente[]) => void): () => void {
  return onSnapshot(collection(db, "clientes"), (snap) => {
    cb(
      snap.docs
        .map((d) => ({ ...(d.data() as Cliente), id: d.id }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
    );
  });
}

export async function createCliente(input: NewClienteInput): Promise<string> {
  const ref = await addDoc(
    collection(db, "clientes"),
    clean({ ...input, createdAt: Date.now() })
  );
  logActivity("Creó cliente", {
    detalle: input.nombre,
    entidad: "cliente",
    entidadId: ref.id,
  });
  return ref.id;
}

export async function updateCliente(
  id: string,
  patch: Partial<NewClienteInput>
): Promise<void> {
  await updateDoc(doc(db, "clientes", id), clean(patch));
  logActivity("Editó cliente", { entidad: "cliente", entidadId: id });
}

export async function deleteCliente(id: string): Promise<void> {
  await deleteDoc(doc(db, "clientes", id));
  logActivity("Eliminó cliente", { entidad: "cliente", entidadId: id });
}
