/**
 * Zona horaria IANA por defecto para negocios que no configuran una propia
 * (`config.timezone`). Compartida entre `handle.ts` (agenda/notificaciones),
 * `agent.ts` (prompt del agente) y `engine/horarios.ts` (validación de
 * citas) para no repetir el literal en cada lugar que lo necesita.
 */
export const DEFAULT_TIMEZONE = "America/Bogota";
