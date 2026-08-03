// Logística de envíos: agrupa remitos (pedidos ya vendidos) en un envío para
// despacharlos juntos, con fecha, flete y estado. El volumen y los pallets se
// calculan con los datos de paquetería (lib/logistica + data/logistica).
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import { logActivity } from "./bitacora";
import type { Envio, EstadoLogistica } from "./types";

export function subscribeEnvios(cb: (xs: Envio[]) => void): () => void {
  return onSnapshot(
    query(collection(db, "envios"), orderBy("fecha", "desc")),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Envio))
  );
}

export interface NewEnvioInput {
  fecha: number;
  transporte: string;
  remitoIds: string[];
  observaciones?: string;
  createdBy?: string;
}

/** Crea el envío y marca sus remitos como "asignado". */
export async function crearEnvio(input: NewEnvioInput): Promise<string> {
  const ref = await addDoc(collection(db, "envios"), {
    fecha: input.fecha,
    transporte: input.transporte,
    estado: "asignado" as EstadoLogistica,
    remitoIds: input.remitoIds,
    observaciones: input.observaciones ?? null,
    createdBy: input.createdBy ?? null,
    createdAt: Date.now(),
  });
  await Promise.all(
    input.remitoIds.map((id) =>
      updateDoc(doc(db, "remitos", id), {
        envioId: ref.id,
        estadoLogistica: "asignado",
      })
    )
  );
  logActivity("Programó un envío", {
    detalle: `${input.remitoIds.length} pedido(s) · ${input.transporte}`,
    entidad: "envio",
    entidadId: ref.id,
  });
  return ref.id;
}

/** Cambia el estado del envío y propaga a sus remitos. */
export async function cambiarEstadoEnvio(
  envio: Envio,
  estado: EstadoLogistica
): Promise<void> {
  await updateDoc(doc(db, "envios", envio.id), { estado });
  await Promise.all(
    envio.remitoIds.map((id) =>
      updateDoc(doc(db, "remitos", id), { estadoLogistica: estado })
    )
  );
  logActivity("Cambió estado de envío", {
    detalle: estado,
    entidad: "envio",
    entidadId: envio.id,
  });
}

/** Borra el envío y libera sus remitos (vuelven a pendientes). */
export async function borrarEnvio(envio: Envio): Promise<void> {
  await Promise.all(
    envio.remitoIds.map((id) =>
      updateDoc(doc(db, "remitos", id), {
        envioId: null,
        estadoLogistica: "pendiente",
      })
    )
  );
  await deleteDoc(doc(db, "envios", envio.id));
  logActivity("Borró un envío", { entidad: "envio", entidadId: envio.id });
}
