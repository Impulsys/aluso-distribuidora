// Interruptor de servicio (control del proveedor). El cliente NO puede tocarlo
// (firestore.rules: config/licencia es write:false; solo consola/admin SDK lo cambia).
// La app lo consulta al conectarse y se bloquea si está inactivo o vencido.
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// Único email autorizado a ver el panel y cambiar el interruptor (el proveedor).
// Debe coincidir con la regla de firestore.rules (config/licencia).
export const OWNER_EMAIL = "axelfaber@gmail.com";

export interface Licencia {
  activa: boolean;
  vencimiento?: number | null; // timestamp ms; pasado ese momento, se bloquea
  mensaje?: string; // texto opcional para la pantalla de bloqueo (sin la palabra "licencia")
}

/** Cambia el interruptor (solo funciona para el OWNER_EMAIL por reglas). */
export async function setLicencia(patch: Partial<Licencia>): Promise<void> {
  await setDoc(doc(db, "config", "licencia"), patch, { merge: true });
}

export function subscribeLicencia(
  cb: (lic: Licencia | null) => void
): () => void {
  return onSnapshot(
    doc(db, "config", "licencia"),
    (snap) => cb(snap.exists() ? (snap.data() as Licencia) : null),
    () => cb(null) // si no se puede leer, no bloqueamos de fábrica
  );
}

/** ¿El servicio está habilitado? Sin doc → habilitado (no bloquea de fábrica). */
export function servicioHabilitado(lic: Licencia | null): boolean {
  if (!lic) return true;
  if (lic.activa === false) return false;
  if (lic.vencimiento && Date.now() > lic.vencimiento) return false;
  return true;
}
