/**
 * Encabezado compartido de portal y back office: título de sección,
 * usuario actual y botón de salir (Server Action signOut).
 */

import Link from "next/link";
import { signOut } from "@/app/login/actions";

interface NavLink {
  href: string;
  label: string;
}

export function SiteHeader({
  title,
  email,
  links,
}: {
  title: string;
  email: string;
  links: NavLink[];
}) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold text-slate-800">{title}</span>
          <nav className="flex gap-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
