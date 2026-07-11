/**
 * Layout del portal de clientes.
 * El middleware ya garantizó que hay sesión; aquí solo se lee el perfil
 * (cualquier rol autenticado puede entrar al portal).
 */

import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Portal" };

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getUserRole();
  if (!me) redirect("/login?next=/portal");

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader
        title="Portal"
        email={me.email}
        links={[
          { href: "/portal", label: "Inicio" },
          { href: "/portal/negocios/nuevo", label: "Nuevo negocio" },
        ]}
      />
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
