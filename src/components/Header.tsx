"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { ROLE_LABELS } from "@/lib/types";
import { can } from "@/lib/roles";

export default function Header() {
  const { user, loading, signOut } = useAuth();
  const { count } = useCart();

  return (
    <header className="bg-primary text-white shadow-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary font-bold text-primary">
            LA
          </span>
          <div className="leading-tight">
            <p className="text-base font-bold sm:text-lg">
              Distribuidora Los Amigos
            </p>
            <p className="text-xs text-secondary">NOA · Distribuidora mayorista</p>
          </div>
        </Link>

        <nav className="flex items-center gap-2 text-sm">
          <Link href="/catalogo" className="hidden rounded px-3 py-2 hover:bg-primary-dark sm:block">
            Catálogo
          </Link>
          {can.venderConPanel(user?.role) && (
            <Link href="/vendedor" className="rounded px-3 py-2 hover:bg-primary-dark">
              Vendedor
            </Link>
          )}
          {can.verReportes(user?.role) && (
            <Link href="/reportes" className="rounded px-3 py-2 hover:bg-primary-dark">
              Reportes
            </Link>
          )}
          {can.administrar(user?.role) && (
            <Link href="/admin" className="rounded px-3 py-2 hover:bg-primary-dark">
              Admin
            </Link>
          )}

          <Link
            href="/carrito"
            aria-label="Carrito"
            className="relative rounded px-3 py-2 hover:bg-primary-dark"
          >
            🛒
            {count > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold">
                {count}
              </span>
            )}
          </Link>

          {loading ? (
            <span className="px-3 py-2 text-secondary">…</span>
          ) : user ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-right sm:block">
                <span className="block font-medium">{user.displayName}</span>
                <span className="block text-xs text-secondary">
                  {ROLE_LABELS[user.role]}
                </span>
              </span>
              <button
                onClick={() => signOut()}
                className="rounded bg-accent px-3 py-2 font-medium hover:opacity-90"
              >
                Salir
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded bg-white px-3 py-2 font-medium text-primary hover:bg-secondary"
            >
              Ingresar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
