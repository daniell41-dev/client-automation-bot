/**
 * Portal · Citas y reservas: servicios reservables, horarios de atención y
 * próximas reservas, con preview del flujo de reserva.
 */

import { notFound } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { parseBusinessConfig } from "@/core/config-schema";
import { CitasEditor } from "./citas-editor";
import { buildSieteFilas } from "./horarios-form";
import { splitReservas, type Reserva } from "./reservas";

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

  // T-20: "vigentes" = todavía confirmadas y sin cerrar (el cierre automático
  // ya sacó de acá a las que se cumplieron). Se ordena por la fecha REAL de
  // la cita (antes era por `updated_at`, que no dice nada de cuándo es);
  // `nullsFirst: false` manda al final las que nunca resolvieron una fecha
  // exacta (negocio sin IA, o fecha ambigua).
  const { data: leads } = await supabase
    .from("leads")
    .select("id, name, service_id, tentative_date, appointment_at")
    .eq("business_slug", slug)
    .eq("stage", "datos_completos")
    .order("appointment_at", { ascending: true, nullsFirst: false })
    .limit(30);

  const reservas: Reserva[] = (leads ?? []).map((l) => ({
    id: l.id,
    nombre: l.name ?? "Cliente",
    servicio:
      config.services.find((s) => s.id === l.service_id)?.name ?? "Servicio",
    fecha: l.appointment_at ?? l.tentative_date ?? "—",
    appointmentAt: l.appointment_at,
  }));
  const { proximas, pasadas } = splitReservas(reservas, new Date());

  return (
    <CitasEditor
      slug={slug}
      initialServices={config.services}
      initialHorarios={buildSieteFilas(config.horarios)}
      initialPedidos={
        config.pedidos ?? {
          enabled: false,
          pregunta: "¿Vas a retirar tu pedido o prefieres comer en el local?",
          opciones: ["Retirar en el local", "Comer en el local"],
        }
      }
      proximas={proximas}
      pasadas={pasadas}
      botName={config.personas?.whatsapp?.name ?? "Asistente"}
      botActivo={config.botActivo !== false}
    />
  );
}
