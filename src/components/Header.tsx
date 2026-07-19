"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { ROLE_LABELS } from "@/lib/types";
import { can } from "@/lib/roles";

export default function Header() {
  const { user, loading, signOut } = useAuth();
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Cerrar el menú móvil al navegar
  useEffect(() => setOpen(false), [pathname]);

  // El contador tiene un área exclusiva: tras loguearse (o si cae en la
  // portada/login/catálogo), se lo lleva directo a /contador.
  useEffect(() => {
    if (loading || user?.role !== "contador") return;
    if (["/", "/login", "/catalogo"].includes(pathname)) {
      router.replace("/contador");
    }
  }, [loading, user, pathname, router]);

  // Bloquear scroll del body cuando el menú móvil está abierto
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const navLinks = (
    <>
      <Link
        href="/catalogo"
        className="rounded px-3 py-2 hover:bg-primary-dark"
      >
        Catálogo
      </Link>
      {can.venderConPanel(user?.role) && (
        <Link
          href="/vendedor"
          className="rounded px-3 py-2 hover:bg-primary-dark"
        >
          Vendedor
        </Link>
      )}
      {can.verReportes(user?.role) && (
        <Link
          href="/reportes"
          className="rounded px-3 py-2 hover:bg-primary-dark"
        >
          Reportes
        </Link>
      )}
      {can.administrar(user?.role) && (
        <Link
          href="/admin"
          className="rounded px-3 py-2 hover:bg-primary-dark"
        >
          Admin
        </Link>
      )}
      {can.verContaduria(user?.role) && (
        <Link
          href="/contador"
          className="rounded px-3 py-2 hover:bg-primary-dark"
        >
          Contaduría
        </Link>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-30 bg-primary text-white shadow-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
        <Link
          href="/"
          className="flex items-center gap-3"
          onClick={() => setOpen(false)}
        >
          <img
            src="/logo-aluso-blanco.png"
            alt="ALUSO DISTRIBUIDORA"
            className="h-16 w-auto object-contain"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-2 text-sm md:flex">
          {navLinks}

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
              <span className="hidden text-right lg:block">
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

        {/* Mobile: carrito + burger */}
        <div className="flex items-center gap-1 md:hidden">
          <Link
            href="/carrito"
            aria-label="Carrito"
            className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-primary-dark"
          >
            🛒
            {count > 0 && (
              <span className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold">
                {count}
              </span>
            )}
          </Link>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-primary-dark"
          >
            <span className="relative block h-4 w-5">
              <span
                className={`absolute left-0 top-0 h-0.5 w-5 bg-white transition-transform ${
                  open ? "translate-y-1.5 rotate-45" : ""
                }`}
              />
              <span
                className={`absolute left-0 top-1.5 h-0.5 w-5 bg-white transition-opacity ${
                  open ? "opacity-0" : ""
                }`}
              />
              <span
                className={`absolute left-0 top-3 h-0.5 w-5 bg-white transition-transform ${
                  open ? "-translate-y-1.5 -rotate-45" : ""
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {/* === Mobile menu === */}
      {open && (
        <>
          <div
            className="fixed inset-0 top-[64px] z-20 bg-black/50 md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <nav className="absolute inset-x-0 top-full z-30 border-t border-white/15 bg-primary px-4 py-3 shadow-xl md:hidden">
            <div className="flex flex-col gap-1 text-sm">{navLinks}</div>
            <div className="my-3 h-px bg-white/15" />
            {loading ? (
              <p className="text-secondary">…</p>
            ) : user ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{user.displayName}</p>
                  <p className="text-xs text-secondary">
                    {ROLE_LABELS[user.role]}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setOpen(false);
                    signOut();
                  }}
                  className="rounded-lg bg-accent px-4 py-2 font-medium"
                >
                  Salir
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="block rounded-lg bg-white px-4 py-2 text-center font-medium text-primary"
              >
                Ingresar
              </Link>
            )}
          </nav>
        </>
      )}
    </header>
  );
}

