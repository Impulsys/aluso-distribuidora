@AGENTS.md

## REGLA DURA: `COORDINACION.md` es el contexto compartido de todas las sesiones

En este repo trabajan cuatro sesiones posibles: Claude en la PC, Claude en la
notebook, Codex en la PC y Codex en la notebook. El único lugar donde las
cuatro se ponen al día es **`COORDINACION.md`** (raíz del repo). Viaja por git.

1. **Al iniciar cualquier sesión**: `git pull`, leer el bloque **"Estado
   actual"** (arriba de todo) y las entradas del registro que no conocías,
   ANTES de tocar nada. Un hook global de Claude Code ya hace el pull y te
   pone ese bloque en contexto; igual es responsabilidad tuya respetarlo. Si
   algo figura "en curso" por otra sesión, no se repite ni se pisa: se
   pregunta.
2. **Todo commit, deploy o acción relevante se registra ahí en el momento**:
   fecha, máquina, agente, rama, detalle y hash/ID. Cada commit incluye su
   entrada en el mismo commit. Cada deploy se registra apenas termina.
3. **Después de cada commit o deploy se reescribe "Estado actual"**: qué hay
   en producción, qué está en curso, qué está pendiente y qué quedó abierto
   entre agentes. Si no se actualiza, la próxima sesión arranca con contexto
   viejo.
4. Al terminar la sesión: pushear (con el "deployá" o equivalente de
   Lautaro). No acumular trabajo local.

## Protocolo con Codex (auditor independiente)

Codex lee `AGENTS.md`, no este archivo ni la memoria. Las reglas que a mí me
tocan:

- **Codex es solo-lectura por defecto.** Edita archivos únicamente cuando
  Lautaro se lo dice explícito para una tarea. Si aparece una entrada
  `edición Codex` en COORDINACION, la reviso archivo por archivo antes de
  commitearla; el commit lo hago yo con OK de Lautaro y registro el hash.
- **Codex sí puede subir a git su auditoría**, y solo eso: `AUDITORIAS.md` +
  su entrada en `COORDINACION.md`, siempre vía `scripts/subir-auditoria.mjs`.
  Es la única excepción a "un solo integrador". Si veo un commit
  `audit(codex):` con otros archivos adentro, es una violación: avisar a
  Lautaro, no arreglarlo en silencio.
- **Cuando Codex deja una auditoría**, mi trabajo es: verificar cada hallazgo
  contra el código, poner estado, completar "Plan de acción" en la misma
  entrada, y registrar. No borro ni reescribo lo que él escribió.
- **Desacuerdos**: se registran como entrada `pregunta` con las dos posturas
  y decide Lautaro. Nunca corregir al otro agente en silencio.
- **Si cambia una regla dura**, `AGENTS.md` y este archivo se actualizan en
  el mismo commit.
