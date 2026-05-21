export default function Footer() {
  return (
    <footer className="mt-auto border-t border-brand-border bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-brand-dark/70 sm:flex-row">
        <p>
          © {new Date().getFullYear()} Distribuidora Los Amigos NOA · Salta /
          NOA, Argentina
        </p>
        <p className="font-medium">
          Hecho por <span className="text-primary">Impulsys</span>
        </p>
      </div>
    </footer>
  );
}
