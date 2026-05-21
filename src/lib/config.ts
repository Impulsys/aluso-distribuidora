import {
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export interface ReportesConfig {
  mostrarGananciaASocios: boolean;
  mostrarGastosASocios: boolean;
  mostrarCajaFisicaASocios: boolean;
  mostrarCargaCamionASocios: boolean;
}

export const DEFAULT_REPORTES_CONFIG: ReportesConfig = {
  mostrarGananciaASocios: true,
  mostrarGastosASocios: true,
  mostrarCajaFisicaASocios: true,
  mostrarCargaCamionASocios: true,
};

const CONFIG_DOC = "config/reportes";

export function subscribeReportesConfig(
  cb: (c: ReportesConfig) => void
): () => void {
  return onSnapshot(doc(db, CONFIG_DOC), (snap) => {
    if (snap.exists()) {
      cb({ ...DEFAULT_REPORTES_CONFIG, ...(snap.data() as ReportesConfig) });
    } else {
      cb(DEFAULT_REPORTES_CONFIG);
    }
  });
}

export async function saveReportesConfig(
  patch: Partial<ReportesConfig>
): Promise<void> {
  await setDoc(doc(db, CONFIG_DOC), patch, { merge: true });
}
