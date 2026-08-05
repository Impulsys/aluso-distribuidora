// Módulo Fletes: transportistas (fleteros) y su cuenta corriente. Cada fletero
// tiene una cuenta independiente de cargos (fletes que te cobraron) y pagos.
// El cálculo del saldo es puro y vive en lib/fleteSaldo (con tests).
// Escritura solo superadmin; lectura vendedor o superior (ver firestore.rules).
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "./firebase";
import { logActivity } from "./bitacora";
import { formatARS } from "./format";
import type { CamionFlete, Fletero, MovimientoFlete, TipoMovFlete } from "./types";

// Firestore rechaza undefined → lo sacamos antes de escribir.
function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as Partial<T>;
}

// ==================== FLETEROS ====================
export function subscribeFleteros(cb: (xs: Fletero[]) => void): () => void {
  return onSnapshot(collection(db, "fleteros"), (snap) => {
    cb(
      snap.docs
        .map((d) => ({ ...(d.data() as Fletero), id: d.id }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
    );
  });
}

export interface NewFleteroInput {
  nombre: string;
  contacto?: string;
  telefono?: string;
  camiones?: CamionFlete[];
  notas?: string;
}

export async function createFletero(input: NewFleteroInput): Promise<string> {
  const ref = await addDoc(
    collection(db, "fleteros"),
    clean({ ...input, camiones: input.camiones ?? [], createdAt: Date.now() })
  );
  logActivity("Creó fletero", {
    detalle: input.nombre,
    entidad: "fletero",
    entidadId: ref.id,
  });
  return ref.id;
}

export async function updateFletero(
  id: string,
  patch: Partial<NewFleteroInput>
): Promise<void> {
  await updateDoc(doc(db, "fleteros", id), clean(patch));
  logActivity("Editó fletero", { entidad: "fletero", entidadId: id });
}

export async function deleteFletero(id: string): Promise<void> {
  // No se borra un fletero con movimientos: primero hay que saldar/borrar su cuenta.
  const movs = await getDocs(
    query(collection(db, "movimientosFlete"), where("fleteroId", "==", id))
  );
  if (!movs.empty) {
    throw new Error("FLETERO_CON_MOVIMIENTOS");
  }
  await deleteDoc(doc(db, "fleteros", id));
  logActivity("Eliminó fletero", { entidad: "fletero", entidadId: id });
}

// ==================== CUENTA (MOVIMIENTOS) ====================
export function subscribeMovimientosFlete(
  cb: (xs: MovimientoFlete[]) => void
): () => void {
  return onSnapshot(collection(db, "movimientosFlete"), (snap) => {
    cb(
      snap.docs
        .map((d) => ({ ...(d.data() as MovimientoFlete), id: d.id }))
        .sort((a, b) => b.fecha - a.fecha)
    );
  });
}

export interface NewMovFleteInput {
  fleteroId: string;
  tipo: TipoMovFlete; // "cargo" = te cobró | "pago" = le pagaste
  monto: number;
  fecha: number;
  detalle?: string;
  envioId?: string;
  createdBy?: string;
}

export async function registrarMovimientoFlete(
  input: NewMovFleteInput
): Promise<string> {
  const ref = await addDoc(
    collection(db, "movimientosFlete"),
    clean({ ...input, createdAt: Date.now() })
  );
  logActivity(input.tipo === "cargo" ? "Registró flete (cargo)" : "Pagó a fletero", {
    detalle: `${formatARS(input.monto)}${input.detalle ? ` · ${input.detalle}` : ""}`,
    entidad: "fletero",
    entidadId: input.fleteroId,
  });
  return ref.id;
}

export async function deleteMovimientoFlete(id: string): Promise<void> {
  await deleteDoc(doc(db, "movimientosFlete", id));
  logActivity("Eliminó movimiento de flete", {
    entidad: "movimientoFlete",
    entidadId: id,
  });
}
