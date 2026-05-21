# Distribuidora Los Amigos NOA

App de catálogo + pedidos + reportes para Distribuidora Los Amigos (pañalería mayorista, NOA, Argentina).
Desarrollada por **Impulsys**.

## Stack

- **Next.js 16** (App Router, TypeScript) + **Tailwind v4**
- **Firebase**: Auth (Google), Firestore, Storage, Hosting
- Moneda **ARS**, locale **es-AR**
- Paleta de marca tomada de conexionesguex.com (`#006081` / `#6fd4e6` / `#f51818`)

## Roles

| Rol | Acceso |
|-----|--------|
| Cliente | Catálogo público, carrito, pedido por WhatsApp (rol por defecto) |
| Vendedor | Catálogo solo precio de venta, arma pedido → WhatsApp + Pedidos |
| Socio administrador | Lectura de reportes habilitados por el superadmin |
| Superadmin (Maxi) | Todo: productos, usuarios, pedidos, camiones, cheques, Caja Fidel |

## Puesta en marcha

1. Crear proyecto en [Firebase Console](https://console.firebase.google.com): habilitar **Authentication → Google**, **Firestore** y **Storage**.
2. Copiar `.env.local.example` a `.env.local` y completar las claves de Firebase, el `NEXT_PUBLIC_WHATSAPP_NUMBER` central y el `NEXT_PUBLIC_SUPERADMIN_EMAIL` (la cuenta Google de Maxi → recibe rol superadmin en el primer ingreso).
3. Instalar y correr:

```bash
npm install
npm run dev
```

App en http://localhost:3000

## Estado (fases)

- [x] **Fase 1** — Scaffolding, branding Guex, Auth Google + roles, seed de 20 productos
- [ ] Fase 2 — Ecommerce + carrito + WhatsApp (consulta y pedido)
- [ ] Fase 3 — Panel Vendedor
- [ ] Fase 4 — Panel Admin (productos+stock, usuarios/roles, pedidos)
- [ ] Fase 5 — Módulo Camiones (operación, carga, económico, ventas, gastos, KPIs)
- [ ] Fase 6 — Cheques (alerta 3 días) + Caja Fidel diario + Reportes socio
- [ ] Fase 7 — Deploy Firebase Hosting + dominio `distribuidoralosamigosnoa.com.ar`
