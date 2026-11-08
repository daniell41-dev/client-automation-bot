/**
 * Separa las reservas vigentes (`stage === "datos_completos"`) en próximas y
 * pasadas, según `appointmentAt` (T-20). Función pura, testeable sin jsdom
 * (mismo criterio que `horarios-form.ts`): `page.tsx` arma la lista desde
 * Supabase y esto decide en qué columna va cada una.
 */

export interface Reserva {
  id: string;
  nombre: string;
  servicio: string;
  /** Texto de fecha listo para mostrar (la fecha real si se resolvió, si no `tentativeDate`). */
  fecha: string;
  /** ISO 8601, o `null` si la IA nunca resolvió una fecha exacta. */
  appointmentAt: string | null;
}

/** Sin fecha exacta: se cuenta como "próxima" (no hay con qué decidir que ya pasó). */
function momento(r: Reserva): number {
  return r.appointmentAt ? new Date(r.appointmentAt).getTime() : Number.POSITIVE_INFINITY;
}

export function splitReservas(
  reservas: Reserva[],
  now: Date,
): { proximas: Reserva[]; pasadas: Reserva[] } {
  const nowMs = now.getTime();
  const proximas: Reserva[] = [];
  const pasadas: Reserva[] = [];
  for (const r of reservas) {
    if (r.appointmentAt && new Date(r.appointmentAt).getTime() < nowMs) {
      pasadas.push(r);
    } else {
      proximas.push(r);
    }
  }
  // Próximas: la más cercana primero (sin fecha exacta, al final).
  proximas.sort((a, b) => momento(a) - momento(b));
  // Pasadas: la más reciente primero (la que más urge cerrar).
  pasadas.sort((a, b) => momento(b) - momento(a));
  return { proximas, pasadas };
}
