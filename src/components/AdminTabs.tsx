"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Menú del panel, agrupado por función para que no sea una pared de botones.
 * Cada grupo es una fila con su etiqueta; el orden sigue el flujo real del
 * negocio: primero lo del día a día, después catálogo, gente, plata y sistema.
 */
type Tab = { href: string; label: string };
type Grupo = { titulo: string; tabs: Tab[] };

const GRUPOS: Grupo[] = [
  {
    titulo: "Operación",
    tabs: [
      { href: "/admin", label: "📊 Resumen" },
      { href: "/admin/pedidos", label: "🧾 Ventas" },
      { href: "/admin/envios", label: "🚚 Envíos" },
    ],
  },
  {
    titulo: "Catálogo",
    tabs: [
      { href: "/admin/productos", label: "📦 Productos" },
      { href: "/admin/precios", label: "🏷️ Precios" },
      { href: "/admin/promociones", label: "⭐ Promociones" },
    ],
  },
  {
    titulo: "Clientes y equipo",
    tabs: [
      { href: "/admin/clientes", label: "👤 Clientes" },
      { href: "/admin/usuarios", label: "👥 Usuarios" },
      { href: "/admin/comisiones", label: "💼 Comisiones" },
    ],
  },
  {
    titulo: "Plata",
    tabs: [
      { href: "/admin/cuentas-clientes", label: "💳 Ctas clientes" },
      { href: "/admin/cuentas", label: "🏭 Ctas proveedores" },
      { href: "/admin/pedido-proveedor", label: "🛒 Pedido al prov." },
      { href: "/admin/fletes", label: "🚛 Fletes" },
      { href: "/admin/gastos", label: "💸 Egresos" },
      { href: "/admin/logistica", label: "🧮 Costo flete" },
      { href: "/contador", label: "📒 Contaduría" },
    ],
  },
  {
    titulo: "Sistema",
    tabs: [
      { href: "/admin/bitacora", label: "📋 Bitácora" },
      { href: "/admin/documentos", label: "📎 Documentos" },
      { href: "/admin/configuracion", label: "⚙️ Configuración" },
      { href: "/admin/asistente", label: "🤖 Asistente IA" },
      { href: "/admin/ia", label: "⚙️ IA (config)" },
    ],
  },
];

export default function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 space-y-2 rounded-2xl bg-surface p-3 ring-1 ring-brand-border">
      {GRUPOS.map((g) => (
        <div key={g.titulo} className="flex flex-wrap items-center gap-1">
          <span className="mr-1 w-full text-[10px] font-bold uppercase tracking-wider text-brand-dark/35 sm:w-28">
            {g.titulo}
          </span>
          {g.tabs.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-primary text-white shadow-sm"
                    : "text-brand-dark hover:bg-primary-light"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
