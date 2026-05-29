"use client";

import { useEffect, useState } from "react";
import { getAllUsers, updateUserRole } from "@/lib/admin";
import {
  adminCreateUser,
  adminSetPassword,
  adminDeleteUser,
  emailToUsername,
} from "@/lib/userAdmin";
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

/** Saca el mensaje legible de un error de Cloud Function (HttpsError). */
function fnErrorMessage(e: unknown, fallback: string): string {
  const msg = (e as { message?: string })?.message;
  return msg && msg.trim() ? msg : fallback;
}

export default function AdminUsuariosPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Formulario "Crear usuario" ---
  const [nombre, setNombre] = useState("");
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<Role>("vendedor");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOk, setCreateOk] = useState<string | null>(null);

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateOk(null);
    if (password.length < 6) {
      setCreateError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setCreating(true);
    try {
      await adminCreateUser({
        username: usuario,
        displayName: nombre,
        password,
        role: rol,
      });
      setCreateOk(`Usuario "${usuario.trim().toLowerCase()}" creado.`);
      setNombre("");
      setUsuario("");
      setPassword("");
      setRol("vendedor");
      await refresh();
    } catch (err) {
      console.error(err);
      setCreateError(fnErrorMessage(err, "No se pudo crear el usuario."));
    } finally {
      setCreating(false);
    }
  };

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

  const handleChangePassword = async (u: AppUser) => {
    const nueva = prompt(
      `Nueva contraseña para "${emailToUsername(u.email)}" (mínimo 6 caracteres):`
    );
    if (nueva === null) return; // canceló
    if (nueva.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setBusy(u.uid);
    try {
      await adminSetPassword(u.uid, nueva);
      alert(`Contraseña actualizada para "${emailToUsername(u.email)}".`);
    } catch (e) {
      console.error(e);
      alert(fnErrorMessage(e, "No se pudo cambiar la contraseña."));
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (u: AppUser) => {
    if (u.uid === me?.uid) {
      alert("No podés eliminar tu propia cuenta.");
      return;
    }
    if (
      !confirm(
        `¿Eliminar al usuario "${u.displayName || emailToUsername(u.email)}"? Esta acción no se puede deshacer.`
      )
    )
      return;
    setBusy(u.uid);
    try {
      await adminDeleteUser(u.uid);
      setUsers((prev) => prev.filter((x) => x.uid !== u.uid));
    } catch (e) {
      console.error(e);
      alert(fnErrorMessage(e, "No se pudo eliminar el usuario."));
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
      {/* ===== Crear usuario ===== */}
      <form
        onSubmit={handleCreate}
        className="mb-6 rounded-xl border border-brand-border bg-surface p-4"
      >
        <h2 className="font-semibold text-brand-dark">Crear usuario</h2>
        <p className="mb-3 text-xs text-brand-dark/60">
          El usuario ingresa con su <b>nombre de usuario</b> y la contraseña que
          le asignes. Después podés cambiarle la contraseña desde la lista.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Nombre</label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Maxi Pérez"
              className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Usuario</label>
            <input
              type="text"
              required
              autoCapitalize="none"
              autoCorrect="off"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="maxi"
              className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Contraseña</label>
            <input
              type="text"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mínimo 6 caracteres"
              className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Rol</label>
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value as Role)}
              className="mt-1 w-full rounded-lg border border-brand-border bg-surface px-3 py-2 outline-none focus:border-primary"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {createError && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {createError}
          </p>
        )}
        {createOk && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            ✓ {createOk}
          </p>
        )}

        <button
          type="submit"
          disabled={creating}
          className="mt-3 rounded-lg bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {creating ? "Creando…" : "Crear usuario"}
        </button>
      </form>

      {/* ===== Lista de usuarios ===== */}
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
                  <p className="text-xs text-brand-dark/60">
                    <span className="font-medium">{emailToUsername(u.email)}</span>
                    <span className="text-brand-dark/40"> · {u.email}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ROLE_STYLES[u.role]}`}
                >
                  {ROLE_LABELS[u.role]}
                </span>
                <button
                  disabled={busy === u.uid}
                  onClick={() => handleChangePassword(u)}
                  className="rounded-full px-3 py-1 text-xs font-medium ring-1 ring-brand-border transition hover:bg-primary-light disabled:opacity-50"
                >
                  Cambiar contraseña
                </button>
                {u.uid !== me?.uid && (
                  <button
                    disabled={busy === u.uid}
                    onClick={() => handleDelete(u)}
                    className="rounded-full px-3 py-1 text-xs font-medium text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-50 disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                )}
              </div>
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
