"use client";

/**
 * Shell del back office: sidebar oscuro (#101828) para distinguirlo del
 * portal + topbar con título por sección. Nav PLATAFORMA: Negocios, Usuarios,
 * Rubros (plantillas), Leads; pie con "Ver portal cliente" y logout.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Inbox,
  Layers,
  LogOut,
  Store,
  Users,
} from "lucide-react";
import { Logo } from "@/components/logo";

const NAV = [
  { href: "/backoffice/negocios", label: "Negocios", Icon: Store },
  { href: "/backoffice/usuarios", label: "Usuarios", Icon: Users },
  { href: "/backoffice/rubros", label: "Rubros (plantillas)", Icon: Layers },
  { href: "/backoffice/leads", label: "Leads", Icon: Inbox },
];

const SUBTITLES: Record<string, { title: string; subtitle: string }> = {
  "/backoffice/negocios": {
    title: "Negocios",
    subtitle: "Todos los negocios de la plataforma",
  },
  "/backoffice/usuarios": {
    title: "Usuarios",
    subtitle: "Clientes y administradores",
  },
  "/backoffice/rubros": {
    title: "Rubros (plantillas)",
    subtitle: "Plantillas verticales: definen qué gestiona cada negocio",
  },
  "/backoffice/asignaciones": {
    title: "Asignaciones",
    subtitle: "Qué rubros puede usar cada cliente",
  },
  "/backoffice/leads": {
    title: "Leads",
    subtitle: "Contactos capturados por los bots",
  },
};

export function BackofficeShell({
  userEmail,
  signOutAction,
  children,
}: {
  userEmail: string;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const current =
    Object.entries(SUBTITLES).find(([href]) => pathname.startsWith(href))?.[1] ??
    SUBTITLES["/backoffice/negocios"];

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* ── Sidebar oscuro ── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[250px] flex-col bg-bo-sidebar md:flex">
        <div className="px-5 pb-4 pt-5">
          <Logo variant="dark" caption="Back office" />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <p className="px-2.5 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-white/40">
            Plataforma
          </p>
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={`mb-0.5 flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-sm font-semibold transition-colors ${
                pathname.startsWith(href)
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="space-y-3 border-t border-white/10 p-4">
          <Link
            href="/portal"
            className="flex items-center gap-2.5 rounded-[10px] bg-white/5 px-2.5 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Ver portal cliente
          </Link>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {userEmail.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-semibold text-white">
                {userEmail}
              </span>
              <span className="block text-xs text-white/50">Administrador</span>
            </span>
            <form action={signOutAction}>
              <button
                type="submit"
                aria-label="Cerrar sesión"
                className="text-white/50 transition-colors hover:text-white"
              >
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ── Contenido ── */}
      <div className="flex min-w-0 flex-1 flex-col md:pl-[250px]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface px-5">
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-[17px] font-extrabold text-ink">
              {current.title}
            </h1>
            <p className="hidden truncate text-xs text-ink-soft sm:block">
              {current.subtitle}
            </p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bo-sidebar text-xs font-bold text-white">
            {userEmail.slice(0, 2).toUpperCase()}
          </span>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-5">
          {children}
        </main>
      </div>

      {/* ── Nav móvil ── */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-white/10 bg-bo-sidebar md:hidden">
        {NAV.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${
              pathname.startsWith(href) ? "text-white" : "text-white/50"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label.split(" ")[0]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
