#!/usr/bin/env node
// Sube a git una auditoría de Codex, y NADA más.
//
// Es la única vía a git que tiene un agente que no sea la sesión principal de
// Claude (ver AGENTS.md, modo 3). Está acotada a propósito: agrega solo
// AUDITORIAS.md y COORDINACION.md, commitea con prefijo fijo y pushea a la
// rama principal. Si algo no cierra, aborta sin tocar nada.
//
// Uso:  node scripts/subir-auditoria.mjs "<título corto de la auditoría>"

import { execFileSync } from "node:child_process";

const ARCHIVOS = ["AUDITORIAS.md", "COORDINACION.md"];

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function abortar(motivo) {
  console.error(`\nNO SE SUBIÓ NADA. ${motivo}\nAvisá en el chat; no lo resuelvas a mano.`);
  process.exit(1);
}

const titulo = process.argv.slice(2).join(" ").trim();
if (!titulo) abortar('Falta el título: node scripts/subir-auditoria.mjs "<título corto>"');
if (titulo.length > 80) abortar("El título tiene que ser corto (máx. 80 caracteres).");

// 1. Rama principal. Se acepta la rama por defecto del remoto, o main/master.
const rama = git("rev-parse", "--abbrev-ref", "HEAD");
let ramaRemota = null;
try {
  ramaRemota = git("symbolic-ref", "--short", "refs/remotes/origin/HEAD").replace(/^origin\//, "");
} catch {}
const permitidas = new Set([ramaRemota, "main", "master"].filter(Boolean));
if (!permitidas.has(rama)) {
  abortar(`Estás en la rama "${rama}" y este script solo sube a la rama principal (${[...permitidas].join(" / ")}).`);
}

// 2. AUDITORIAS.md tiene que haber cambiado; si no, no hay nada que subir.
const modificados = git("status", "--porcelain", "--", ...ARCHIVOS)
  .split("\n")
  .filter(Boolean)
  .map((l) => l.slice(3).trim());
if (!modificados.includes("AUDITORIAS.md")) {
  abortar("AUDITORIAS.md no tiene cambios. Este script solo sube auditorías.");
}
if (!modificados.includes("COORDINACION.md")) {
  abortar("Falta tu entrada en COORDINACION.md (tipo `auditoría`). Escribila y volvé a correr el script.");
}

// 3. El staging tiene que estar vacío ANTES de tocar nada: si otra sesión de
//    esta misma máquina dejó algo staged, se aborta. Nunca se resetea el
//    staging ajeno (eso desarmaría el trabajo de otro).
const yaStaged = git("diff", "--cached", "--name-only").split("\n").filter(Boolean);
if (yaStaged.length) {
  abortar(`Hay archivos en staging que no son de esta auditoría: ${yaStaged.join(", ")}. Otra sesión está a mitad de un commit.`);
}

// 4. Traer lo último sin pisar nada. --autostash guarda y repone cualquier
//    otro cambio local (por ejemplo, una edición del modo 2 aún no commiteada).
try {
  git("pull", "--rebase", "--autostash", "origin", rama);
} catch (e) {
  abortar(`git pull --rebase falló (probablemente conflicto en ${ARCHIVOS.join(" o ")}):\n${e.stderr || e.message}`);
}

// 5. Agregar SOLO los dos archivos permitidos y verificar el staging.
git("add", "--", ...ARCHIVOS);
const staged = git("diff", "--cached", "--name-only").split("\n").filter(Boolean);
const extra = staged.filter((f) => !ARCHIVOS.includes(f));
if (extra.length) abortar(`Quedaron archivos fuera de alcance en el staging: ${extra.join(", ")}`);
if (!staged.length) abortar("No hay nada para commitear después del pull.");

// 6. Commit con prefijo fijo y push.
git("commit", "-m", `audit(codex): ${titulo}`);
const hash = git("rev-parse", "--short", "HEAD");
try {
  git("push", "origin", rama);
} catch (e) {
  abortar(`El commit ${hash} quedó local pero el push falló:\n${e.stderr || e.message}`);
}

console.log(`Auditoría subida: ${hash} · audit(codex): ${titulo}`);
console.log(`Archivos: ${staged.join(", ")}`);
