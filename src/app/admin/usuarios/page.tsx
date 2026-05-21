"use client";

import { useEffect, useState } from "react";
import { getAllUsers, updateUserRole } from "@/lib/admin";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/format";
import { ROLE_LABELS, type AppUser, type Role } from "@/lib/types";

const ROLES: Role[] = ["cliente", "vendedor", "socio", "superadmin"];

const ROLE_STYLES: Record<Role, string> = {
  cliente: "bg-slate-100 text-slate-800",
  vendedor: "bg-sky-100 text-sky-800",
  socio: "bg-amber-100 text-amber-800",
  superadmin: "bg-rose-100 text-rose-800",
};

export default function AdminUsuariosPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setUsers(await getAllUsers());
      setError(null);
    } catch (e) {
      console.error(e);
      setError("No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleRole = async (uid: string, role: Role) => {
    if (uid === me?.uid && role !== "superadmin") {
      if (
        !confirm(
          "¡Atención! Te estás cambiando a vos mismo el rol y vas a perder acceso al admin. ¿Continuar?"
        )
      )
        return;
    }
    setBusy(uid);
    try {
      await updateUserRole(uid, role);
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, role } : u))
      );
    } catch (e) {
      console.error(e);
      alert("No se pudo cambiar el rol.");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <p className="py-8 text-center text-brand-dark/60">Cargando…</p>;
  }
  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
        {error}
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-brand-dark/60">
        {users.length} usuario{users.length === 1 ? "" : "s"} registrado
        {users.length === 1 ? "" : "s"} · clic en un rol para asignarlo
      </p>
      <div className="space-y-2">
        {users.map((u) => (
          <article
            key={u.uid}
            className="rounded-xl border border-brand-border bg-surface p-4 transition hover:shadow-md"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary-light font-bold text-primary">
                  {(u.displayName || u.email || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-brand-dark">
                    {u.displayName || "(sin nombre)"}
                    {u.uid === me?.uid && (
                      <span className="ml-2 rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                        Vos
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-brand-dark/60">{u.email}</p>
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ROLE_STYLES[u.role]}`}
              >
                {ROLE_LABELS[u.role]}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-brand-border pt-3">
              <span className="text-xs text-brand-dark/50">Asignar rol:</span>
              {ROLES.map((r) => (
                <button
                  key={r}
                  disabled={busy === u.uid || u.role === r}
                  onClick={() => handleRole(u.uid, r)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition disabled:opacity-50 ${
                    u.role === r
                      ? `${ROLE_STYLES[r]} ring-inset`
                      : "bg-surface text-brand-dark/70 ring-brand-border hover:bg-primary-light"
                  }`}
                >
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-brand-dark/40">
              Registrado: {formatDate(u.createdAt)}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
