"use client";

/**
 * Shell del panel del portal: sidebar 250px + topbar 64px + tab bar móvil.
 *
 * Server-driven: recibe el negocio activo, la lista de negocios (switcher) y
 * el usuario; las mutaciones (toggle del bot, logout) son Server Actions.
 * En <768px el sidebar se oculta y aparece la tab bar inferior del handoff.
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  ChevronsUpDown,
  LayoutGrid,
  LogOut,
  MessageCircle,
  MessagesSquare,
  ShoppingBag,
  SlidersHorizontal,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { RubroTile, catalogLabel } from "@/components/rubro-visual";
import { Pill } from "@/components/ui";

export interface ShellNegocio {
  slug: string;
  nombre: string;
  rubro: string;
  botActivo: boolean;
}

export function PortalShell({
  negocio,
  negocios,
  userEmail,
  toggleBotAction,
  signOutAction,
  children,
}: {
  negocio: ShellNegocio;
  negocios: ShellNegocio[];
  userEmail: string;
  toggleBotAction: (formData: FormData) => Promise<void>;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const base = `/portal/negocios/${negocio.slug}`;
  const nav = [
    { href: base, label: "Resumen", Icon: LayoutGrid, group: "GESTIÓN DEL BOT" },
    {
      href: `${base}/catalogo`,
      label: catalogLabel(negocio.rubro),
      Icon: ShoppingBag,
      group: "GESTIÓN DEL BOT",
    },
    {
      href: `${base}/citas`,
      label: "Citas y reservas",
      Icon: CalendarDays,
      group: "GESTIÓN DEL BOT",
    },
    {
      href: `${base}/respuestas`,
      label: "Respuestas y flujos",
      Icon: MessageCircle,
      group: "GESTIÓN DEL BOT",
    },
    {
      href: `${base}/conversaciones`,
      label: "Conversaciones",
      Icon: MessagesSquare,
      group: "ATENCIÓN",
    },
    {
      href: `${base}/configuracion`,
      label: "Configuración",
      Icon: SlidersHorizontal,
      group: "ATENCIÓN",
    },
  ];

  const isActive = (href: string) =>
    href === base ? pathname === base : pathname.startsWith(href);

  const current = nav.find((item) => isActive(item.href));

  const subtitles: Record<string, string> = {
    Resumen: `Panorama del bot en ${negocio.nombre}`,
    [catalogLabel(negocio.rubro)]: "Lo que el bot puede ofrecer y vender por WhatsApp",
    "Citas y reservas": "Turnos y reservas que el bot agenda automáticamente",
    "Respuestas y flujos": "Cómo responde el bot: IA entrenada + reglas de respaldo",
    Conversaciones: "Chats de tus clientes en tiempo real",
    Configuración: "Datos del negocio, horarios y bot",
  };

  // Tab bar móvil: 4 accesos del handoff.
  const mobileTabs = [
    { href: base, label: "Resumen", Icon: LayoutGrid },
    { href: `${base}/catalogo`, label: catalogLabel(negocio.rubro), Icon: ShoppingBag },
    { href: `${base}/citas`, label: "Citas", Icon: CalendarDays },
    { href: `${base}/conversaciones`, label: "Chats", Icon: MessagesSquare },
  ];

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* ── Sidebar ── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[250px] flex-col border-r border-line bg-surface md:flex">
        <div className="px-5 pb-2 pt-5">
          <Link href="/portal">
            <Logo />
          </Link>
        </div>

        {/* Switcher de negocio */}
        <div className="relative px-3 pt-3">
          <button
            type="button"
            onClick={() => setSwitcherOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 rounded-xl border border-line p-2.5 text-left transition-colors hover:bg-surface-3"
          >
            <RubroTile rubroNombre={negocio.rubro} size="sm" />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-bold text-ink">
                {negocio.nombre}
              </span>
              <span className="block text-xs text-ink-soft">{negocio.rubro}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-ink-soft" />
          </button>

          {switcherOpen && (
            <div className="pop-in absolute inset-x-3 top-full z-40 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-lift">
              {negocios.map((n) => (
                <Link
                  key={n.slug}
                  href={`/portal/negocios/${n.slug}`}
                  onClick={() => setSwitcherOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-surface-3 ${
                    n.slug === negocio.slug ? "bg-primary-tint" : ""
                  }`}
                >
                  <RubroTile rubroNombre={n.rubro} size="sm" />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {n.nombre}
                    </span>
                    <span className="block text-xs text-ink-soft">{n.rubro}</span>
                  </span>
                </Link>
              ))}
              <Link
                href="/portal"
                onClick={() => setSwitcherOpen(false)}
                className="block border-t border-line px-3 py-2.5 text-sm font-semibold text-primary hover:bg-surface-3"
              >
                Ver todos los rubros
              </Link>
            </div>
          )}
        </div>

        {/* Navegación */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {(["GESTIÓN DEL BOT", "ATENCIÓN"] as const).map((group) => (
            <div key={group} className="mb-4">
              <p className="px-2.5 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-soft">
                {group}
              </p>
              {nav
                .filter((item) => item.group === group)
                .map(({ href, label, Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`mb-0.5 flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-sm font-semibold transition-colors ${
                      isActive(href)
                        ? "bg-primary-tint text-primary-hover"
                        : "text-ink-mid hover:bg-surface-3 hover:text-ink"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {label}
                  </Link>
                ))}
            </div>
          ))}
        </nav>

        {/* Pie: usuario + logout */}
        <div className="flex items-center gap-2.5 border-t border-line p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            {userEmail.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-semibold text-ink">
              {userEmail}
            </span>
            <span className="block text-xs text-ink-soft">Dueña/o</span>
          </span>
          <form action={signOutAction}>
            <button
              type="submit"
              aria-label="Cerrar sesión"
              className="text-ink-soft transition-colors hover:text-ink"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </form>
        </div>
      </aside>

      {/* ── Contenido ── */}
      <div className="flex min-w-0 flex-1 flex-col md:pl-[250px]">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface px-5">
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-[17px] font-extrabold text-ink">
              {current?.label ?? "Panel"}
            </h1>
            <p className="hidden truncate text-xs text-ink-soft sm:block">
              {subtitles[current?.label ?? ""] ?? negocio.nombre}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Toggle del bot */}
            <form action={toggleBotAction}>
              <input type="hidden" name="slug" value={negocio.slug} />
              <input
                type="hidden"
                name="next"
                value={(!negocio.botActivo).toString()}
              />
              <button type="submit" title="Pausar / activar el bot">
                <Pill tone={negocio.botActivo ? "success" : "warn"} dot>
                  {negocio.botActivo ? "Bot activo" : "Bot en pausa"}
                </Pill>
              </button>
            </form>

            <span className="relative text-ink-mid">
              <Bell className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-warn ring-2 ring-surface" />
            </span>

            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {userEmail.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </header>

        {/* Área scrolleable */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-5 pb-24 md:pb-5">
          {children}
        </main>
      </div>

      {/* ── Tab bar móvil ── */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface md:hidden">
        {mobileTabs.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] font-semibold ${
              isActive(href) ? "text-primary" : "text-ink-soft"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
