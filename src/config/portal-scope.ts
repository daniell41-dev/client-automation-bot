/**
 * Alcance del portal del cliente (T-16, decisión 2.7 del plan).
 *
 * "Respuestas y flujos" y "Conversaciones" NO se borran (código y rutas
 * siguen en el repo, se puede entrar por URL directa): solo se ocultan de la
 * navegación y de cualquier link dentro del portal. Para reactivar una
 * sección, sacarla de `PORTAL_SECCIONES_OCULTAS` — es la ÚNICA lista que hay
 * que tocar (`portal-shell.tsx` y el Resumen la consultan, no duplican la
 * decisión).
 *
 * "Citas y reservas" se reactivó en T-20: sin ella el dueño no tenía forma
 * de cargar los horarios de atención que el bot ahora valida, ni de marcar
 * una cita como atendida.
 */
export type PortalSeccion =
  | "resumen"
  | "catalogo"
  | "citas"
  | "respuestas"
  | "conversaciones"
  | "configuracion";

export const PORTAL_SECCIONES_OCULTAS: readonly PortalSeccion[] = ["respuestas", "conversaciones"];

export function seccionVisible(seccion: PortalSeccion): boolean {
  return !PORTAL_SECCIONES_OCULTAS.includes(seccion);
}
