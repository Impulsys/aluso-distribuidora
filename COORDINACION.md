# COORDINACION — aluso-distribuidora

Documento compartido entre TODAS las sesiones que trabajan en este repo: Claude en la PC, Claude en la notebook, Codex en la PC, Codex en la notebook. Es la última versión del contexto. El canal es el repo: este archivo viaja con git.

## Estado actual (leer antes de cualquier tarea)

_Última actualización: 2026-08-25 · DESKTOP-LAUTARO · Claude. Lo reescribe quien commitea o deploya._

- **Producción**: (a completar por la primera sesión que trabaje acá: qué corre, dónde, desde qué commit — o "sin producción").
- **En curso**: nada.
- **Pendiente (en orden)**: (a completar en el próximo commit).
- **Pendientes entre agentes**: ninguno.

## Regla dura

1. Toda acción relevante se registra acá EN EL MOMENTO en que se hace: commits, deploys, migraciones, cambios de reglas/índices, instalación de dependencias, cambios de configuración, auditorías, ediciones de Codex aprobadas.
2. Cada commit incluye su entrada correspondiente en este archivo (en el mismo commit).
3. Cada deploy se registra apenas termina, con proyecto/entorno y resultado.
4. **Después de cada commit o deploy se reescribe "Estado actual"**: es el resumen de una pantalla que la próxima sesión lee en vez de todo el registro. Si no se actualiza, la próxima sesión arranca con contexto viejo.
5. Al empezar a trabajar en cualquier máquina o agente: `git pull`, leer "Estado actual" y las entradas nuevas antes de tocar nada. Si algo figura "en curso" por otra sesión, no se repite ni se pisa: se pregunta.
6. Al terminar la sesión: pushear. No acumular trabajo local.
7. **Quién escribe qué**: Claude registra commits, deploys y decisiones. Codex registra sus auditorías (tipo `auditoría`), sus ediciones aprobadas por Lautaro (tipo `edición Codex`, con la lista exacta de archivos) y sus desacuerdos (tipo `pregunta`, con las dos posturas). Codex sube su entrada a git solo junto con `AUDITORIAS.md` vía `scripts/subir-auditoria.mjs`; cualquier otra cosa la commitea Claude. Nadie reescribe la entrada de otro: si algo está mal, entrada nueva que lo diga.

## Formato de entrada

Agregar las entradas nuevas ARRIBA de las anteriores, con este formato:

```
### AAAA-MM-DD HH:MM | <máquina> · <Claude | Codex> | <tipo: commit / deploy / config / auditoría / edición Codex / pregunta / otro>
- Rama: <rama>
- Qué se hizo: <detalle corto>
- Hash / ID: <hash de commit o id de deploy, si aplica>
- Avisos: <lo que las otras sesiones tienen que saber>
```

## Registro

### 2026-08-25 14:45 | DESKTOP-LAUTARO · Claude | commit (protocolo entre agentes: Codex con permisos completos solo con OK explícito)
- Rama: main
- Qué se hizo: Lautaro amplió el modo 2 de Codex: con OK explícito por tarea puede hacer TODO lo que Lautaro nombre (editar, commitear, pushear, deployar); el permiso cubre exactamente lo que dijo y no arrastra a la tarea siguiente. Sin OK explícito, sigue siendo solo lectura. Se regeneró `AGENTS.md` desde la plantilla vigente conservando la descripción y las reglas propias de este repo, y se reemplazó la sección de protocolo en `CLAUDE.md`. Prohibiciones que quedan en cualquier modo (seguridad, no permisos): reescribir historial compartido, subir secretos o datos de clientes, reescribir entradas ajenas, pisar lo que figura en curso.
- Hash / ID: (este commit)
- Avisos: NADA deployado.

### 2026-08-25 14:20 | DESKTOP-LAUTARO · Claude | commit (protocolo entre agentes instalado)
- Rama: main
- Qué se hizo: instalado el protocolo Claude/Codex replicado desde nodoarquitectura: `AGENTS.md` (Codex solo-lectura por defecto, edición solo con OK explícito de Lautaro por tarea, subida de auditorías por script), `AUDITORIAS.md`, este archivo con el bloque "Estado actual", la sección de protocolo en `CLAUDE.md` y `scripts/subir-auditoria.mjs`. Un hook global de Claude Code lee este archivo y hace `git pull` al abrir cada sesión.
- Hash / ID: (este commit)
- Avisos: "Estado actual" tiene campos a completar por la primera sesión que trabaje acá. NADA deployado.
