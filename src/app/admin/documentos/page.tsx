"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  subscribeDocumentos,
  subirDocumento,
  borrarDocumento,
  type Documento,
} from "@/lib/documentos";
import { formatDate } from "@/lib/format";

const kb = (b: number) =>
  b < 1024 * 1024
    ? `${Math.round(b / 1024)} KB`
    : `${(b / 1024 / 1024).toFixed(1)} MB`;

const iconoDe = (tipo: string) => {
  if (tipo.startsWith("image/")) return "🖼️";
  if (tipo.startsWith("audio/")) return "🎵";
  if (tipo.startsWith("video/")) return "🎬";
  if (tipo.includes("pdf")) return "📕";
  if (tipo.includes("sheet") || tipo.includes("excel")) return "📊";
  if (tipo.includes("word") || tipo.includes("document")) return "📄";
  return "📎";
};

export default function DocumentosPage() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<Documento[]>([]);
  const [nota, setNota] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState("");

  useEffect(() => subscribeDocumentos(setDocs), []);

  const subir = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSubiendo(true);
    try {
      const lista = Array.from(files);
      for (let i = 0; i < lista.length; i++) {
        setProgreso(`Subiendo ${i + 1}/${lista.length}: ${lista[i].name}`);
        await subirDocumento(lista[i], { nota, uid: user?.uid });
      }
      setNota("");
    } catch (e) {
      console.error(e);
      alert("No se pudo subir algún archivo. ¿Pesa más de 50 MB?");
    } finally {
      setSubiendo(false);
      setProgreso("");
    }
  };

  const borrar = async (d: Documento) => {
    if (!confirm(`¿Borrar "${d.nombre}"?`)) return;
    try {
      await borrarDocumento(d);
    } catch {
      alert("No se pudo borrar.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-brand-dark">Documentación</h2>
        <p className="text-sm text-brand-dark/60">
          Subí cualquier archivo complementario al sistema: fotos, audios, PDFs,
          planillas, comprobantes. Queda guardado y disponible para el equipo.
        </p>
      </div>

      {/* Subida */}
      <div className="rounded-2xl border border-brand-border bg-surface p-4">
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Nota / descripción (opcional) — se aplica a lo que subas ahora"
          className="mb-3 w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label
            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white ${
              subiendo ? "bg-primary/60" : "bg-primary hover:bg-primary-dark"
            }`}
          >
            {subiendo ? "Subiendo…" : "📎 Subir archivos"}
            <input
              type="file"
              multiple
              disabled={subiendo}
              className="hidden"
              onChange={(e) => subir(e.target.files)}
            />
          </label>
          <span className="text-[11px] text-brand-dark/45">
            Cualquier tipo · hasta 50 MB por archivo · podés elegir varios
          </span>
        </div>
        {progreso && (
          <p className="mt-2 text-xs text-brand-dark/60">{progreso}</p>
        )}
      </div>

      {/* Lista */}
      {docs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-brand-border p-8 text-center text-sm text-brand-dark/50">
          Todavía no hay documentación cargada.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex flex-col overflow-hidden rounded-xl border border-brand-border bg-surface"
            >
              {/* Preview */}
              {d.tipo.startsWith("image/") ? (
                <a href={d.url} target="_blank" rel="noreferrer">
                  <img
                    src={d.url}
                    alt={d.nombre}
                    className="h-40 w-full object-cover"
                  />
                </a>
              ) : d.tipo.startsWith("audio/") ? (
                <div className="flex h-40 items-center justify-center bg-primary-light/30 p-3">
                  <audio controls src={d.url} className="w-full" />
                </div>
              ) : (
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-40 items-center justify-center bg-primary-light/20 text-5xl"
                >
                  {iconoDe(d.tipo)}
                </a>
              )}

              {/* Meta */}
              <div className="flex flex-1 flex-col gap-1 p-3">
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-sm font-medium text-brand-dark hover:underline"
                  title={d.nombre}
                >
                  {iconoDe(d.tipo)} {d.nombre}
                </a>
                {d.nota && (
                  <p className="text-xs text-brand-dark/60">{d.nota}</p>
                )}
                <div className="mt-auto flex items-center justify-between pt-1 text-[11px] text-brand-dark/45">
                  <span>
                    {kb(d.tamano)} · {formatDate(d.createdAt)}
                  </span>
                  <div className="flex gap-2">
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="font-medium text-primary hover:underline"
                    >
                      Descargar
                    </a>
                    <button
                      onClick={() => borrar(d)}
                      className="font-medium text-brand-dark/40 hover:text-red-600"
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
