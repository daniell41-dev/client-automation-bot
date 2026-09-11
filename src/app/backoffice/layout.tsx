/**
 * Layout del back office: SOLO administradores.
 * El middleware garantiza sesión; aquí se exige el rol admin y se monta el
 * shell oscuro (fuente de verdad server-side, complementaria a RLS).
 */

import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/supabase/server";
import { BackofficeShell } from "@/components/backoffice-shell";
import { signOut } from "@/app/login/actions";

export const metadata = { title: "Back office — Nexo" };

export default async function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getUserRole();
  if (!me) redirect("/login?next=/backoffice");
  if (me.role !== "admin") redirect("/portal");

  return (
    <BackofficeShell userEmail={me.email} signOutAction={signOut}>
      {children}
    </BackofficeShell>
  );
}
