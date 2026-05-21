import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Truck } from "./types";

export type NewTruckInput = Pick<
  Truck,
  "nombre" | "color" | "fechaIngreso" | "porcentajeGanancia"
> &
  Partial<Pick<Truck, "descripcion" | "costoCamion" | "proveedor" | "transporte">>;

/**
 * Crea un camión. Si hay alguno "activo" (sin fechaCierre) lo cierra
 * automáticamente con fecha = fechaIngreso del nuevo (≈ instante de transición).
 * Reglas del cliente: "ya que entra un camion, se venden los productos y
 * recien ingresa otro" → 1 solo activo a la vez.
 */
export async function createTruck(input: NewTruckInput): Promise<string> {
  // 1. Cerrar el activo previo (si hay)
  const snap = await getDocs(collection(db, "trucks"));
  const activos = snap.docs
    .map((d) => ({ ...(d.data() as Truck), id: d.id }))
    .filter((t) => !t.fechaCierre);
  for (const a of activos) {
    await updateDoc(doc(db, "trucks", a.id), {
      fechaCierre: input.fechaIngreso,
    });
  }
  // 2. Crear el nuevo
  const ref = await addDoc(collection(db, "trucks"), {
    ...input,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function updateTruck(
  id: string,
  patch: Partial<Truck>
): Promise<void> {
  await updateDoc(doc(db, "trucks", id), patch);
}

export async function deleteTruck(id: string): Promise<void> {
  await deleteDoc(doc(db, "trucks", id));
}

export function subscribeTrucks(cb: (trucks: Truck[]) => void): () => void {
  const q = query(collection(db, "trucks"), orderBy("fechaIngreso", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ ...(d.data() as Truck), id: d.id })));
  });
}

/**
 * Para un día dado (timestamp), devuelve el camión activo (el último cuyo
 * fechaIngreso <= día y (fechaCierre indefinido o > día)).
 */
export function findTruckForDay(
  trucks: Truck[],
  dayStart: number
): Truck | null {
  // trucks viene ordenado desc por fechaIngreso
  for (const t of trucks) {
    if (t.fechaIngreso <= dayStart) {
      if (!t.fechaCierre || t.fechaCierre > dayStart) return t;
    }
  }
  return null;
}
