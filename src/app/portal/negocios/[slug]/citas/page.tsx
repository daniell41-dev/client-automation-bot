/**
 * Portal · Citas y reservas: servicios reservables, horarios de atención y
 * próximas reservas, con preview del flujo de reserva.
 */

import { notFound } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { parseBusinessConfig } from "@/core/config-schema";
import { CitasEditor, type ProximaReserva } from "./citas-editor";

export const dynamic = "force-dynamic";

export default async function CitasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createUserClient();

  const { data: negocio } = await supabase
    .from("negocios")
    .select("config")
    .eq("slug", slug)
    .maybeSingle();
  if (!negocio) notFound();
  const config = parseBusinessConfig(negocio.config);
  if (!config) notFound();

  const { data: leads } = await supabase
    .from("leads")
    .select("id, name, service_id, tentative_date, state, updated_at")
    .eq("business_slug", slug)
    .eq("state", "agendado")
    .order("updated_at", { ascending: false })
    .limit(6);

  const reservas: ProximaReserva[] = (leads ?? []).map((l) => ({
    id: l.id,
    nombre: l.name ?? "Cliente",
    servicio:
      config.services.find((s) => s.id === l.service_id)?.name ?? "Servicio",
    fecha: l.tentative_date ?? "—",
  }));

  return (
    <CitasEditor
      slug={slug}
      initialServices={config.services}
      initialHorarios={
        config.horarios ?? [
          { dia: "Lunes a viernes", desde: "09:00", hasta: "20:00", abierto: true },
          { dia: "Sábado", desde: "09:00", hasta: "13:00", abierto: true },
          { dia: "Domingo", desde: "00:00", hasta: "00:00", abierto: false },
        ]
      }
      reservas={reservas}
      botName={config.personas?.whatsapp?.name ?? "Asistente"}
      botActivo={config.botActivo !== false}
    />
  );
}
