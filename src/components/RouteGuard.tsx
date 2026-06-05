"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { hasRole } from "@/lib/roles";
import { ROLE_LABELS, type Role } from "@/lib/types";

export default function RouteGuard({
  min,
  roles,
  children,
}: {
  min: Role;
  /** Roles extra permitidos además de `min` y superiores (ej. ["contador"]). */
  roles?: Role[];
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || (!user && !loading)) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <p className="text-brand-dark/60">Cargando…</p>
      </div>
    );
  }

  const permitido =
    hasRole(user!.role, min) || (roles?.includes(user!.role) ?? false);
  if (!permitido) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h2 className="font-serif text-2xl text-brand-dark">
          Acceso restringido
        </h2>
        <p className="mt-2 text-brand-dark/70">
          Estás como <b>{ROLE_LABELS[user!.role]}</b> y esta sección requiere
          rol <b>{ROLE_LABELS[min]}</b> o superior.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-primary px-5 py-2 font-medium text-white"
        >
          Ir al inicio
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
