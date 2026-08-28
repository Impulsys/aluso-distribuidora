// Documentación complementaria: sube CUALQUIER archivo (fotos, audio, PDF, etc.)
// a Storage y guarda sus metadatos en Firestore para poder listarlos.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "./firebase";
import { logActivity } from "./bitacora";

export interface Documento {
  id: string;
  nombre: string; // nombre original del archivo
  url: string; // download URL de Storage
  path: string; // ruta en Storage (para poder borrarlo)
  tipo: string; // MIME
  tamano: number; // bytes
  nota?: string; // descripción opcional
  subidoPor?: string;
  createdAt: number;
}

export function subscribeDocumentos(
  cb: (xs: Documento[]) => void
): () => void {
  const q = query(collection(db, "documentos"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Documento));
  });
}

/** Sube un archivo a Storage y registra sus metadatos. */
export async function subirDocumento(
  file: File,
  opts: { nota?: string; uid?: string } = {}
): Promise<Documento> {
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `documentacion/${Date.now()}-${safe}`;
  const r = ref(storage, path);
  await uploadBytes(r, file, { contentType: file.type || undefined });
  const url = await getDownloadURL(r);

  const base = {
    nombre: file.name,
    url,
    path,
    tipo: file.type || "application/octet-stream",
    tamano: file.size,
    nota: opts.nota?.trim() || "",
    subidoPor: opts.uid ?? null,
    createdAt: Date.now(),
  };
  const docRef = await addDoc(collection(db, "documentos"), base);
  logActivity("Subió documentación", {
    detalle: `${file.name} (${Math.round(file.size / 1024)} KB)`,
    entidad: "documento",
    entidadId: docRef.id,
  });
  return { id: docRef.id, ...base } as Documento;
}

export async function borrarDocumento(d: Documento): Promise<void> {
  // Borrar el archivo de Storage (si falla, igual limpiamos el metadato).
  try {
    await deleteObject(ref(storage, d.path));
  } catch {
    /* el archivo puede ya no estar */
  }
  await deleteDoc(doc(db, "documentos", d.id));
  logActivity("Borró documentación", {
    detalle: d.nombre,
    entidad: "documento",
    entidadId: d.id,
  });
}
