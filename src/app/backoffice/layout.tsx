/**
 * Layout del back office: SOLO administradores.
 * El middleware garantiza sesión; aquí se exige el rol admin (fuente de
 * verdad server-side, complementaria a las políticas RLS).
 */

import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Back office" };

export default async function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getUserRole();
  if (!me) redirect("/login?next=/backoffice");
  if (me.role !== "admin") redirect("/portal");

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader
        title="Back office"
        email={me.email}
        links={[
          { href: "/backoffice/usuarios", label: "Usuarios" },
          { href: "/backoffice/rubros", label: "Rubros" },
          { href: "/backoffice/asignaciones", label: "Asignaciones" },
          { href: "/backoffice/negocios", label: "Negocios" },
          { href: "/backoffice/leads", label: "Leads" },
        ]}
      />
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
