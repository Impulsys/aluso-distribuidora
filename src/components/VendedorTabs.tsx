"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/vendedor", label: "Nuevo pedido" },
  { href: "/vendedor/pedidos", label: "Mis pedidos" },
];

export default function VendedorTabs() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 inline-flex rounded-xl bg-surface p-1 ring-1 ring-brand-border">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              active
                ? "bg-primary text-white shadow-sm"
                : "text-brand-dark hover:bg-primary-light"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
