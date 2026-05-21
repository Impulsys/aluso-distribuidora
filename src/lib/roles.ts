import type { Role } from "./types";

// Jerarquía: superadmin > socio > vendedor > cliente
const RANK: Record<Role, number> = {
  cliente: 0,
  vendedor: 1,
  socio: 2,
  superadmin: 3,
};

export function hasRole(role: Role | undefined, min: Role): boolean {
  if (!role) return false;
  return RANK[role] >= RANK[min];
}

export const can = {
  verPrecioCosto: (r?: Role) => r === "superadmin" || r === "socio",
  venderConPanel: (r?: Role) => r === "vendedor" || r === "superadmin",
  verReportes: (r?: Role) => r === "socio" || r === "superadmin",
  administrar: (r?: Role) => r === "superadmin",
  gestionarCamiones: (r?: Role) => r === "superadmin",
};
