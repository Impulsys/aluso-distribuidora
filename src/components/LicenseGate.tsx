"use client";

import { useEffect, useState } from "react";
import {
  subscribeLicencia,
  servicioHabilitado,
  type Licencia,
} from "@/lib/licencia";

export default function LicenseGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [lic, setLic] = useState<Licencia | null>(null);
  const [cargado, setCargado] = useState(false);

  useEffect(
    () =>
      subscribeLicencia((l) => {
        setLic(l);
        setCargado(true);
      }),
    []
  );

  if (cargado && !servicioHabilitado(lic)) {
    return <LockScreen mensaje={lic?.mensaje} />;
  }
  return <>{children}</>;
}

function LockScreen({ mensaje }: { mensaje?: string }) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-brand-light p-6 text-center">
      <div className="max-w-md rounded-2xl border border-brand-border bg-surface p-8 shadow-xl">
        <div className="text-4xl">🔒</div>
        <h1 className="mt-3 font-serif text-2xl text-brand-dark">
          Servicio no disponible
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-brand-dark/70">
          {mensaje ||
            "El sistema está temporalmente fuera de servicio. Comunicate con el administrador para reactivarlo."}
        </p>
      </div>
    </div>
  );
}
