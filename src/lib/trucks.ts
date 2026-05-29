import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
  getDocs,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Truck } from "./types";

export type NewTruckInput = Pick<
  Truck,
  "nombre" | "color" | "fechaIngreso" | "porcentajeGanancia"
> &
  Partial<
    Pick<
      Truck,
      | "descripcion"
      | "costoCamion"
      | "proveedor"
      | "proveedorOtro"
      | "transporte"
      | "transporteOtro"
      | "numeroRemito"
      | "numeroFactura"
    >
  >;

/**
 * Crea un camión. Si hay alguno "activo" (sin fechaCierre) lo cierra
 * automáticamente con fecha = fechaIngreso del nuevo (≈ instante de transición).
 * Reglas del cliente: "ya que entra un camion, se venden los productos y
 * recien ingresa otro" → 1 solo activo a la vez.
 */
export class TruckValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TruckValidationError";
  }
}

// Helper: Firestore rechaza valores undefined. Los limpiamos antes de enviar.
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

export async function createTruck(input: NewTruckInput): Promise<string> {
  // 1. Validar que la fecha de ingreso no sea anterior al activo previo
  const snap = await getDocs(collection(db, "trucks"));
  const activos = snap.docs
    .map((d) => ({ ...(d.data() as Truck), id: d.id }))
    .filter((t) => !t.fechaCierre);
  for (const a of activos) {
    if (input.fechaIngreso < a.fechaIngreso) {
      throw new TruckValidationError(
        `La fecha de ingreso es anterior al camión activo "${a.nombre}". ` +
          `Ingresá una fecha posterior o cerrá manualmente el anterior.`
      );
    }
  }
  // 2. Cerrar el activo previo
  for (const a of activos) {
    await updateDoc(doc(db, "trucks", a.id), {
      fechaCierre: input.fechaIngreso,
    });
  }
  // 3. Crear el nuevo (sin undefineds — Firestore los rechaza)
  const ref = await addDoc(
    collection(db, "trucks"),
    stripUndefined({ ...input, createdAt: Date.now() })
  );
  return ref.id;
}

export async function updateTruck(
  id: string,
  patch: Partial<Truck>
): Promise<void> {
  await updateDoc(doc(db, "trucks", id), patch);
}

export async function updateTruckCargo(
  id: string,
  carga: NonNullable<Truck["carga"]>
): Promise<void> {
  await updateDoc(doc(db, "trucks", id), { carga });
}

export async function deleteTruck(id: string): Promise<void> {
  // Bloquear el borrado si tiene pedidos asignados
  const ordersSnap = await getDocs(
    query(collection(db, "orders"), where("truckId", "==", id), limit(1))
  );
  if (!ordersSnap.empty) {
    throw new TruckValidationError(
      "Este camión tiene pedidos asignados. Reasigná los pedidos antes de eliminarlo."
    );
  }
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
