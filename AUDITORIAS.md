# AUDITORIAS — aluso-distribuidora

Registro versionado de todas las auditorías que se hacen sobre este proyecto:
de código, de datos del cliente, de permisos, de flujo. Una entrada por
auditoría, la más nueva arriba.

Es el punto de encuentro entre agentes: **Codex deja acá su revisión** y la
sube a git con `scripts/subir-auditoria.mjs` (el único commit que puede hacer:
este archivo + su entrada en `COORDINACION.md`). La sesión principal de Claude
la lee en su próxima sesión, en cualquier máquina, verifica cada hallazgo,
propone el plan de acción y lo integra con aprobación de Lautaro. Nada de lo
que se audita se corrige "en silencio": cada hallazgo tiene un estado y, cuando
se corrige, el commit que lo corrigió.

## Reglas

1. Cada hallazgo cita **archivo y línea** (o hoja y celda si es un dato).
   Sin cita, no es hallazgo: es una opinión.
2. Cada hallazgo tiene **estado**: `ABIERTO` · `CORREGIDO (hash)` ·
   `DESCARTADO (motivo)` · `DIFERIDO (cuándo)`. Lo cambia quien integra.
3. Se distingue lo que **rompe** (bug, fuga de permisos, plata mal calculada)
   de lo que **mejora** (deuda, estilo, duplicación). Primero lo que rompe.
4. El auditor **no corrige**: reporta. Quien integra decide y registra.
5. Lo dudoso va como **pregunta**, no como conclusión. Adivinar es peor que
   preguntar.
6. **No se pegan datos sensibles**: ni montos de clientes con nombre y
   apellido, ni credenciales, ni contenido de planillas de clientes. Se cita
   la ubicación, no el contenido.

## Formato de entrada

```
## AAAA-MM-DD · <título corto> · auditor: <Claude PC | Claude notebook | Codex | persona>
**Alcance:** qué se revisó y qué no.
**Método:** cómo (lectura, scripts, pruebas, contra qué reglas).

| # | Severidad | Hallazgo | Dónde | Estado |
|---|---|---|---|---|
| 1 | ROMPE / MEJORA | ... | archivo:línea | ABIERTO |

**Verificado sano:** lo que se miró y estaba bien (para no re-auditarlo).
**Preguntas:** lo que no se pudo resolver leyendo.
**Plan de acción:** (lo completa quien integra) qué se hace, en qué orden, hash.
```

---

(Sin auditorías todavía.)
