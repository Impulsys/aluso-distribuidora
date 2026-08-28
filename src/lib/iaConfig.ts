// Configuración del módulo de IA (OpenAI). Modelo "traé tu propia clave": el
// cliente carga SU API key de OpenAI y paga su propio consumo.
//
// SEGURIDAD: la API key se guarda en `secretos/ia`, un doc con LECTURA DENEGADA
// a todos desde el navegador (ver firestore.rules). Solo la Cloud Function la
// lee por Admin SDK (que saltea las reglas). En el navegador nunca se puede leer
// de vuelta: la solapa solo muestra si HAY una clave cargada (flag público en
// `config/ia`), nunca la clave.
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export interface IaConfig {
  habilitada: boolean; // master switch del módulo
  modelo: string; // modelo de OpenAI a usar (visión)
  tieneClave: boolean; // ¿hay una API key cargada? (flag público, NO la clave)
}

export const DEFAULT_IA_CONFIG: IaConfig = {
  habilitada: false,
  modelo: "gpt-4o",
  tieneClave: false,
};

const CONFIG_DOC = "config/ia"; // público (solo settings, sin la clave)
const SECRETO_DOC = "secretos/ia"; // read: false — solo lo lee la function

export function subscribeIaConfig(cb: (c: IaConfig) => void): () => void {
  return onSnapshot(doc(db, CONFIG_DOC), (snap) => {
    if (snap.exists()) {
      cb({ ...DEFAULT_IA_CONFIG, ...(snap.data() as Partial<IaConfig>) });
    } else {
      cb(DEFAULT_IA_CONFIG);
    }
  });
}

/** Guarda settings NO secretos (switch, modelo). No toca la clave. */
export async function saveIaConfig(patch: Partial<IaConfig>): Promise<void> {
  await setDoc(doc(db, CONFIG_DOC), patch, { merge: true });
}

/**
 * Guarda (o reemplaza) la API key de OpenAI en el doc secreto y prende el flag
 * público `tieneClave`. La clave NUNCA se puede leer de vuelta desde el navegador.
 */
export async function guardarClaveOpenAI(apiKey: string): Promise<void> {
  const key = apiKey.trim();
  await setDoc(
    doc(db, SECRETO_DOC),
    { openaiKey: key, updatedAt: Date.now() },
    { merge: true }
  );
  await saveIaConfig({ tieneClave: key.length > 0 });
}

/** Borra la clave cargada (deja el módulo sin credencial). */
export async function borrarClaveOpenAI(): Promise<void> {
  await setDoc(doc(db, SECRETO_DOC), { openaiKey: "", updatedAt: Date.now() });
  await saveIaConfig({ tieneClave: false, habilitada: false });
}
