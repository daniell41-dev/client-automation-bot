/**
 * Cálculo de seguimientos.
 *
 * "La parte más valiosa": detectar leads que mostraron interés pero no avanzaron
 * y calcular qué mensaje de seguimiento toca enviarles (2h / 1 día / 3 días).
 *
 * Esto es SOLO cálculo (función pura). El envío real por WhatsApp depende de un
 * cron y de plantillas aprobadas por Meta → es fase 2. Aquí dejamos la lógica
 * lista y testeada.
 */

import type { BusinessConfig, FollowUp, Lead } from "@/core/types";
import { render } from "@/core/engine/templating";
import { needsFollowUp } from "@/core/engine/lead-state";

/** Minutos transcurridos entre dos instantes. */
function minutesBetween(from: string, to: Date): number {
  return (to.getTime() - new Date(from).getTime()) / 60000;
}

/** Variables disponibles para las plantillas de seguimiento. */
function followUpVars(lead: Lead, config: BusinessConfig) {
  const service = config.services.find((s) => s.id === lead.serviceId);
  return {
    nombre: lead.name ?? "",
    servicio: service?.name ?? "",
    negocio: config.name,
    agenda: config.bookingUrl ?? "",
  };
}

/**
 * Devuelve el siguiente seguimiento pendiente para un lead, o `null`.
 *
 * Elige el umbral con menor `afterMinutes` que (a) aún no se ha enviado y (b) ya
 * venció. Así un cron envía los seguimientos en orden, uno por ejecución.
 */
export function nextFollowUp(
  lead: Lead,
  config: BusinessConfig,
  now: Date = new Date(),
): FollowUp | null {
  if (!needsFollowUp(lead.state)) return null;

  const elapsed = minutesBetween(lead.lastInboundAt, now);
  const ordered = [...config.followUps].sort(
    (a, b) => a.afterMinutes - b.afterMinutes,
  );

  for (const cfg of ordered) {
    if (lead.followUpsSent.includes(cfg.threshold)) continue;
    if (elapsed >= cfg.afterMinutes) {
      const dueAt = new Date(
        new Date(lead.lastInboundAt).getTime() + cfg.afterMinutes * 60000,
      ).toISOString();
      return {
        leadId: lead.id,
        contact: lead.contact,
        businessSlug: lead.businessSlug,
        threshold: cfg.threshold,
        message: render(cfg.message, followUpVars(lead, config)),
        dueAt,
      };
    }
  }

  return null;
}

/**
 * Calcula los seguimientos pendientes para un conjunto de leads de un negocio.
 * Devuelve a lo sumo uno por lead (el siguiente en su secuencia).
 */
export function dueFollowUps(
  leads: Lead[],
  config: BusinessConfig,
  now: Date = new Date(),
): FollowUp[] {
  const result: FollowUp[] = [];
  for (const lead of leads) {
    const fu = nextFollowUp(lead, config, now);
    if (fu) result.push(fu);
  }
  return result;
}
