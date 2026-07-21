<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 🛑 Distribuidora Los Amigos NOA NO SE TOCA

Este proyecto es un **clon** de `distribuidora-losamigos-noa`, que es **otro cliente,
está en producción y funcionando bien**. Orden del dueño (20/07/2026):

> "Los Amigos queda blindada. Salvo un pedido puntual, no se toca más."

**Nunca**, desde este repo:

- Correr comandos contra el proyecto Firebase `distribuidora-los-amigos-noa`
  (ni `deploy`, ni `firestore:delete`, ni nada que escriba). Las lecturas también
  se evitan salvo que haga falta y se avise.
- Traer acá su `serviceAccountKey.json` ni sus certificados de AFIP. Se borraron
  a propósito el 20/07/2026 (los originales viven en
  `D:/Proyectos/Clientes/distribuidora-losamigos-noa`). Si un script pide
  credenciales, hay que generar las **de ALUSO**, no copiar las de ellos.
- Reintroducir sus datos: CUIT `20250642114`, punto de venta `6`, dominio
  `dlanoa.com`, `Balcarce 836 · La Quiaca, Jujuy`, `maxi@distribuidoralosamigosnoa.com.ar`,
  el teléfono `+54 9 11 2759-7572` o el dominio `distribuidora-los-amigos-noa.web.app`.

Todo eso venía heredado del clon y estaba **activo**: la cabecera de remitos y
facturas, `emitirFactura` (que habría emitido comprobantes en ARCA contra el CUIT
de ellos), el pie de los reportes PDF, el sitemap, el dominio de los usuarios y
los scripts de AFIP. Se limpió el 20/07/2026. Si volvés a ver alguno de esos
valores en el código, es un error, no una configuración.

## Estado de ALUSO

- Proyecto Firebase propio: `aluso-distribuidora` (Firestore en `southamerica-east1`).
- Datos del negocio (CUIT, domicilio, teléfono, mail) **vacíos a propósito**: los
  carga el cliente en `https://alusodistribuidora.web.app/formulario-datos-aluso`
  y caen en la colección `formularioDatos`.
- AFIP sin configurar: los secretos `AFIP_CUIT`, `AFIP_PTO_VENTA`, `AFIP_CERT` y
  `AFIP_KEY` están en `PENDIENTE` y `emitirFactura` aborta antes de tocar ARCA.
  Los scripts de `scripts/afip-*.mjs` exigen `AFIP_CUIT` por variable de entorno.
