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
  getDoc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { logActivity } from "./bitacora";
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
      | "logisticaDetalle"
      | "proveedor"
      | "proveedorOtro"
      | "proveedorId"
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

export interface RecibirCamionInput {
  // Datos del camión
  nombre: string;
  color: string;
  fechaIngreso: number;
  porcentajeGanancia: number;
  transporte?: string;
  transporteOtro?: string;
  descripcion?: string;
  // Proveedor (OBLIGATORIO — toda compra corresponde a un camión)
  proveedorId: string;
  proveedorNombre: string;
  // Comprobantes — al menos UNO con monto > 0
  facturaA?: { numero: string; monto: number }; // modalidad A (facturado)
  remitoB?: { numero: string; monto: number }; // modalidad B (sin facturar)
  // Logística (opcional): gasto del camión que baja la ganancia real
  logistica?: number;
  logisticaDetalle?: string;
  createdBy?: string;
}

/**
 * "Llegó un camión": punto de entrada único. Crea el camión (cerrando el activo
 * previo) y genera la(s) compra(s)/deuda(s) al proveedor (A y/o B), enlazadas al
 * camión por camionId. La logística se guarda como costoCamion (se descuenta en
 * la ganancia real del reporte). Reutiliza createTruck + createPurchase.
 */
export async function recibirCamion(
  input: RecibirCamionInput
): Promise<string> {
  if (!input.proveedorId || !input.proveedorNombre) {
    throw new TruckValidationError("Elegí un proveedor para el camión.");
  }
  const tieneA = !!input.facturaA && input.facturaA.monto > 0;
  const tieneB = !!input.remitoB && input.remitoB.monto > 0;
  if (!tieneA && !tieneB) {
    throw new TruckValidationError(
      "Cargá al menos un comprobante (Factura A o Remito B) con su monto."
    );
  }

  // Recepción ATÓMICA: el camión y sus comprobantes entran juntos o no entra
  // nada. Antes eran 3 escrituras sueltas: si la red se cortaba en el medio,
  // quedaba el camión creado sin su deuda (o con una sola), el usuario apretaba
  // "Recibir" de nuevo y se DUPLICABA la deuda al proveedor.
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

  const batch = writeBatch(db);
  // Cerrar el/los activo(s) previo(s): 1 solo camión activo a la vez.
  for (const a of activos) {
    batch.update(doc(db, "trucks", a.id), { fechaCierre: input.fechaIngreso });
  }

  const truckRef = doc(collection(db, "trucks"));
  batch.set(
    truckRef,
    stripUndefined({
      nombre: input.nombre,
      color: input.color,
      fechaIngreso: input.fechaIngreso,
      porcentajeGanancia: input.porcentajeGanancia,
      transporte: input.transporte,
      transporteOtro: input.transporteOtro,
      descripcion: input.descripcion,
      proveedor: input.proveedorNombre,
      proveedorId: input.proveedorId,
      costoCamion:
        input.logistica && input.logistica > 0 ? input.logistica : undefined,
      logisticaDetalle: input.logisticaDetalle?.trim() || undefined,
      numeroFactura: tieneA ? input.facturaA!.numero : undefined,
      numeroRemito: tieneB ? input.remitoB!.numero : undefined,
      createdAt: Date.now(),
    })
  );

  const base = {
    proveedorId: input.proveedorId,
    proveedorNombre: input.proveedorNombre,
    fecha: input.fechaIngreso,
    camionId: truckRef.id,
    camionNombre: input.nombre,
    createdBy: input.createdBy,
    createdAt: Date.now(),
  };
  if (tieneA) {
    batch.set(
      doc(collection(db, "purchases")),
      stripUndefined({
        ...base,
        modalidad: "A",
        numero: input.facturaA!.numero,
        monto: input.facturaA!.monto,
      })
    );
  }
  if (tieneB) {
    batch.set(
      doc(collection(db, "purchases")),
      stripUndefined({
        ...base,
        modalidad: "B",
        numero: input.remitoB!.numero,
        monto: input.remitoB!.monto,
      })
    );
  }

  await batch.commit();

  logActivity("Recibió camión", {
    detalle: `${input.nombre} · ${input.proveedorNombre}`,
    entidad: "camion",
    entidadId: truckRef.id,
  });

  return truckRef.id;
}

export async function updateTruck(
  id: string,
  patch: Partial<Truck>
): Promise<void> {
  await updateDoc(doc(db, "trucks", id), patch);
  logActivity("Editó camión", { entidad: "camion", entidadId: id });
}

export async function updateTruckCargo(
  id: string,
  carga: NonNullable<Truck["carga"]>
): Promise<void> {
  await updateDoc(doc(db, "trucks", id), { carga });
  logActivity("Editó carga de camión", { entidad: "camion", entidadId: id });
}

/**
 * Carga ACTUAL del camión en la base (no la que tenía la pantalla al abrirse).
 *
 * El editor guarda el array `carga` completo. Si dos personas cargan el mismo
 * camión a la vez, el que guarda segundo borraba todo lo del primero. Antes de
 * escribir hay que releer y mezclar.
 */
export async function getTruckCargo(
  id: string
): Promise<NonNullable<Truck["carga"]>> {
  const snap = await getDoc(doc(db, "trucks", id));
  return (snap.data()?.carga ?? []) as NonNullable<Truck["carga"]>;
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
  logActivity("Eliminó camión", { entidad: "camion", entidadId: id });
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
