/**
 * Alcance v1 del portal del cliente (T-16, decisión 2.7 del plan): el cliente
 * solo puede tocar Catálogo, el bot (nombre/tono) y el conocimiento del
 * negocio — todo desde Resumen, Catálogo y Configuración.
 *
 * "Citas y reservas", "Respuestas y flujos" y "Conversaciones" NO se borran
 * (código y rutas siguen en el repo, se puede entrar por URL directa): solo
 * se ocultan de la navegación y de cualquier link dentro del portal. Para
 * reactivar una sección, sacarla de este array — es la ÚNICA lista que hay
 * que tocar (`portal-shell.tsx` y el Resumen la consultan, no duplican la
 * decisión).
 */
export const PORTAL_SECCIONES_OCULTAS = ["citas", "respuestas", "conversaciones"] as const;

export type PortalSeccion = (typeof PORTAL_SECCIONES_OCULTAS)[number] | "resumen" | "catalogo" | "configuracion";

export function seccionVisible(seccion: PortalSeccion): boolean {
  return !(PORTAL_SECCIONES_OCULTAS as readonly string[]).includes(seccion);
}
