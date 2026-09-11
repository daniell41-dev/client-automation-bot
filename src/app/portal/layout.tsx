/**
 * Guard del portal: exige sesión (cualquier rol autenticado).
 * El chrome visual lo pone cada vista: la selección de rubro tiene su topbar
 * y el panel del negocio su propio shell (sidebar + topbar).
 */

import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/supabase/server";

export const metadata = { title: "Portal — Nexo" };

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getUserRole();
  if (!me) redirect("/login?next=/portal");
  return <>{children}</>;
}
