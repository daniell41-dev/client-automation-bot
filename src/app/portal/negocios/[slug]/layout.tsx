/**
 * Layout del panel de UN negocio: monta el shell (sidebar + topbar + tab bar)
 * con el negocio activo y la lista para el switcher. RLS garantiza que solo
 * el dueño (o admin) resuelve el negocio.
 */

import { notFound } from "next/navigation";
import { createUserClient, getUserRole } from "@/lib/supabase/server";
import { parseBusinessConfig } from "@/core/config-schema";
import { PortalShell, type ShellNegocio } from "@/components/portal-shell";
import { toggleBotActivo } from "@/app/portal/actions";
import { signOut } from "@/app/login/actions";

export default async function NegocioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const me = await getUserRole();
  const supabase = await createUserClient();

  const { data: negocios } = await supabase
    .from("negocios")
    .select("slug, config, rubros(nombre)")
    .order("updated_at", { ascending: false });

  const shellNegocios: ShellNegocio[] = (negocios ?? []).map((n) => {
    const config = parseBusinessConfig(n.config);
    return {
      slug: n.slug,
      nombre: config?.name ?? n.slug,
      rubro:
        (n.rubros as unknown as { nombre: string } | null)?.nombre ?? "Negocio",
      botActivo: config?.botActivo !== false,
    };
  });

  const activo = shellNegocios.find((n) => n.slug === slug);
  if (!activo) notFound();

  return (
    <PortalShell
      negocio={activo}
      negocios={shellNegocios}
      userEmail={me!.email}
      toggleBotAction={toggleBotActivo}
      signOutAction={signOut}
    >
      {children}
    </PortalShell>
  );
}
