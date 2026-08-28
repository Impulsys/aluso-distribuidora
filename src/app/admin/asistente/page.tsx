"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useProducts } from "@/hooks/useProducts";
import { subscribeRemitos } from "@/lib/ventas";
import { subscribeClientes } from "@/lib/clientes";
import { subscribeIaConfig, DEFAULT_IA_CONFIG } from "@/lib/iaConfig";
import {
  analizarVentasIA,
  chatConIA,
  construirContextoSistema,
  type AnalisisVentas,
  type ChatMsg,
} from "@/lib/ia";
import { a4Shell, a4Toolbar, a4Header, abrirA4, ars, esc } from "@/lib/a4";
import { formatDate } from "@/lib/format";
import type { Cliente, Remito } from "@/lib/types";

const PERIODOS = [
  { dias: 30, label: "30 días" },
  { dias: 60, label: "60 días" },
  { dias: 90, label: "90 días" },
];

export default function AsistenteIaPage() {
  const [iaCfg, setIaCfg] = useState(DEFAULT_IA_CONFIG);
  const productos = useProducts();
  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  const [dias, setDias] = useState(30);
  const [analisis, setAnalisis] = useState<AnalisisVentas | null>(null);
  const [anBusy, setAnBusy] = useState(false);
  const [anErr, setAnErr] = useState<string | null>(null);

  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [entrada, setEntrada] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeIaConfig(setIaCfg), []);
  useEffect(() => subscribeRemitos(setRemitos), []);
  useEffect(() => subscribeClientes(setClientes), []);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, chatBusy]);

  const contexto = useMemo(
    () => construirContextoSistema(productos, remitos, clientes, Date.now()),
    [productos, remitos, clientes]
  );

  const errMsg = (e: unknown) => {
    const m = (e as { message?: string }).message ?? "";
    if (m.includes("API key") || m.includes("inválida"))
      return "La API key de OpenAI es inválida. Revisala en Configuración de IA.";
    if (m.includes("crédito") || m.includes("límite"))
      return "Tu cuenta de OpenAI está sin crédito o con límite de uso.";
    if (m.includes("No hay API key"))
      return "Falta cargar la API key en Configuración de IA.";
    return "No se pudo completar. Probá de nuevo.";
  };

  const analizar = async () => {
    setAnErr(null);
    setAnBusy(true);
    try {
      setAnalisis(await analizarVentasIA(dias));
    } catch (e) {
      console.error(e);
      setAnErr(errMsg(e));
    } finally {
      setAnBusy(false);
    }
  };

  const enviar = async () => {
    const texto = entrada.trim();
    if (!texto || chatBusy) return;
    const nuevos: ChatMsg[] = [...chat, { role: "user", content: texto }];
    setChat(nuevos);
    setEntrada("");
    setChatBusy(true);
    try {
      const reply = await chatConIA(nuevos, contexto);
      setChat([...nuevos, { role: "assistant", content: reply }]);
    } catch (e) {
      console.error(e);
      setChat([
        ...nuevos,
        { role: "assistant", content: "⚠️ " + errMsg(e) },
      ]);
    } finally {
      setChatBusy(false);
    }
  };

  const descargarPDF = () => {
    if (!analisis) return;
    const kpis = `
      <div style="display:flex;gap:16px;margin:14px 0;flex-wrap:wrap">
        <div style="flex:1;min-width:140px;border:1px solid #e2dccf;border-radius:8px;padding:10px">
          <div style="font-size:10px;color:#667;text-transform:uppercase">Ventas ${analisis.periodoDias}d</div>
          <div style="font-size:18px;font-weight:700;color:#0a6480">${ars(analisis.totalVentas)}</div>
        </div>
        <div style="flex:1;min-width:140px;border:1px solid #e2dccf;border-radius:8px;padding:10px">
          <div style="font-size:10px;color:#667;text-transform:uppercase">Recomendaciones</div>
          <div style="font-size:18px;font-weight:700;color:#0a6480">${analisis.recomendaciones.length}</div>
        </div>
      </div>`;
    const masV = analisis.masVendidos
      .map(
        (m) =>
          `<tr><td>${esc(m.nombre)}</td><td class="num">${m.vendidas}</td><td class="num">${m.stock}</td><td class="num">${ars(m.ingresos)}</td></tr>`
      )
      .join("");
    const recs = analisis.recomendaciones
      .map(
        (r) =>
          `<li style="margin-bottom:8px"><b>${esc(r.producto ?? "")}</b> — ${esc(
            r.razon ?? ""
          )}${r.sugerencia ? ` <i>(${esc(r.sugerencia)})</i>` : ""}</li>`
      )
      .join("");
    const obs = analisis.observaciones
      .map((o) => `<li>${esc(o)}</li>`)
      .join("");
    const body = `${a4Toolbar()}<div class="hoja">${a4Header()}
      <div class="doc-head"><span class="tipo">ANÁLISIS DE VENTAS</span>
        <div style="text-align:right"><div class="fecha">${formatDate(Date.now())} · últimos ${analisis.periodoDias} días</div></div>
      </div>
      <p style="margin:10px 0">${esc(analisis.resumen)}</p>
      ${kpis}
      <h3 style="margin:16px 0 6px">Más vendidos</h3>
      <table><thead><tr><th>Producto</th><th class="num">Vendidas</th><th class="num">Stock</th><th class="num">Ingresos</th></tr></thead><tbody>${masV}</tbody></table>
      <h3 style="margin:16px 0 6px">Recomendaciones de compra</h3>
      <ul>${recs || "<li>—</li>"}</ul>
      ${obs ? `<h3 style="margin:16px 0 6px">Observaciones</h3><ul>${obs}</ul>` : ""}
      <p class="nota">Generado por el Asistente IA de ALUSO. Los números son del sistema; las recomendaciones son sugerencias.</p>
    </div>`;
    abrirA4(a4Shell("Análisis de ventas", body));
  };

  if (!iaCfg.habilitada) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        El asistente de IA está apagado. Andá a{" "}
        <Link href="/admin/ia" className="font-semibold underline">
          Configuración de IA
        </Link>{" "}
        para cargar tu API key de OpenAI y habilitarlo.
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,440px)]">
      {/* ===== Análisis ===== */}
      <section className="space-y-4">
        <div>
          <h2 className="font-serif text-2xl text-brand-dark">Análisis de ventas</h2>
          <p className="text-sm text-brand-dark/60">
            La IA analiza el período y sugiere qué reponer. Los números salen del
            sistema; el análisis lo arma la IA.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PERIODOS.map((p) => (
            <button
              key={p.dias}
              onClick={() => setDias(p.dias)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                dias === p.dias
                  ? "bg-primary text-white"
                  : "bg-primary-light text-primary"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={analizar}
            disabled={anBusy}
            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {anBusy ? "Analizando…" : "Analizar"}
          </button>
          {analisis && (
            <button
              onClick={descargarPDF}
              className="rounded-lg border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary hover:text-white"
            >
              📄 Descargar PDF
            </button>
          )}
        </div>

        {anErr && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {anErr}
          </p>
        )}

        {anBusy && !analisis && (
          <p className="text-sm text-brand-dark/50">Leyendo las ventas…</p>
        )}

        {analisis && (
          <div className="space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-brand-border bg-surface p-3">
                <div className="text-[10px] uppercase tracking-wider text-brand-dark/45">
                  Ventas {analisis.periodoDias}d
                </div>
                <div className="font-serif text-xl font-semibold text-primary">
                  {ars(analisis.totalVentas)}
                </div>
              </div>
              <div className="rounded-xl border border-brand-border bg-surface p-3">
                <div className="text-[10px] uppercase tracking-wider text-brand-dark/45">
                  Recomendaciones
                </div>
                <div className="font-serif text-xl font-semibold text-primary">
                  {analisis.recomendaciones.length}
                </div>
              </div>
            </div>

            {analisis.resumen && (
              <p className="rounded-xl border border-brand-border bg-primary-light/20 p-3 text-sm text-brand-dark">
                {analisis.resumen}
              </p>
            )}

            {/* Más vendidos */}
            {analisis.masVendidos.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-brand-border bg-surface">
                <div className="grid grid-cols-[1fr_70px_60px_90px] gap-2 border-b border-brand-border bg-primary-light px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  <span>Producto</span>
                  <span className="text-right">Vend.</span>
                  <span className="text-right">Stock</span>
                  <span className="text-right">Ingresos</span>
                </div>
                <ul className="divide-y divide-brand-border">
                  {analisis.masVendidos.map((m, i) => (
                    <li
                      key={i}
                      className="grid grid-cols-[1fr_70px_60px_90px] gap-2 px-3 py-2 text-sm"
                    >
                      <span className="truncate text-brand-dark">{m.nombre}</span>
                      <span className="text-right tabular-nums">{m.vendidas}</span>
                      <span
                        className={`text-right tabular-nums ${
                          m.stock < 0 ? "font-bold text-red-600" : "text-brand-dark/70"
                        }`}
                      >
                        {m.stock}
                      </span>
                      <span className="text-right tabular-nums text-brand-dark/70">
                        {ars(m.ingresos)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recomendaciones */}
            {analisis.recomendaciones.length > 0 && (
              <div>
                <h3 className="mb-2 font-semibold text-brand-dark">
                  🛒 Recomendaciones de compra
                </h3>
                <ul className="space-y-2">
                  {analisis.recomendaciones.map((r, i) => (
                    <li
                      key={i}
                      className="rounded-xl border border-brand-border bg-surface p-3 text-sm"
                    >
                      <div className="font-semibold text-brand-dark">
                        {r.producto}
                      </div>
                      <div className="text-brand-dark/70">{r.razon}</div>
                      {r.sugerencia && (
                        <div className="mt-1 text-xs font-medium text-emerald-700">
                          → {r.sugerencia}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analisis.observaciones.length > 0 && (
              <div className="rounded-xl border border-brand-border bg-surface p-3 text-sm">
                <div className="mb-1 font-semibold text-brand-dark">Observaciones</div>
                <ul className="list-disc pl-5 text-brand-dark/70">
                  {analisis.observaciones.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ===== Chat ===== */}
      <section className="flex h-[70vh] flex-col rounded-2xl border border-brand-border bg-surface lg:sticky lg:top-4">
        <div className="border-b border-brand-border px-4 py-3">
          <h2 className="font-serif text-lg text-brand-dark">Chat con el asistente</h2>
          <p className="text-[11px] text-brand-dark/50">
            Ve todo el sistema (ventas, stock, faltantes, deudas). Preguntale lo que
            quieras del negocio.
          </p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {chat.length === 0 && (
            <div className="space-y-2 text-sm text-brand-dark/55">
              <p>Ejemplos:</p>
              {[
                "¿Qué me conviene comprar este mes?",
                "¿Qué clientes me deben más?",
                "¿Qué productos están estancados?",
              ].map((ej) => (
                <button
                  key={ej}
                  onClick={() => setEntrada(ej)}
                  className="block rounded-lg bg-primary-light/40 px-3 py-1.5 text-left text-primary hover:bg-primary-light"
                >
                  {ej}
                </button>
              ))}
            </div>
          )}
          {chat.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "ml-auto bg-primary text-white"
                  : "bg-primary-light/40 text-brand-dark"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          ))}
          {chatBusy && (
            <div className="max-w-[85%] rounded-2xl bg-primary-light/40 px-3 py-2 text-sm text-brand-dark/50">
              escribiendo…
            </div>
          )}
          <div ref={chatEnd} />
        </div>

        <div className="border-t border-brand-border p-3">
          <div className="flex gap-2">
            <textarea
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              rows={1}
              placeholder="Escribí tu pregunta…"
              className="flex-1 resize-none rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={enviar}
              disabled={chatBusy || !entrada.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
            >
              Enviar
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
