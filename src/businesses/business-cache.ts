/**
 * Caché en memoria de la resolución de negocios (T-06).
 *
 * `resolveBusinessByPhoneNumberId` se llama una vez POR MENSAJE ENTRANTE de
 * CADA negocio, para leer una config que cambia una vez por semana — un
 * negocio con 500 mensajes/día son 500 lecturas evitables a Supabase.
 *
 * Se evaluó `unstable_cache` de Next (lo que sugería el plan original), pero
 * depende del `incrementalCache` que Next arma para una request real:
 * lanza `Invariant: incrementalCache missing` llamado desde dentro de
 * `after()` (que es exactamente donde vive `processWebhookPayload`, ver
 * T-05) y en los tests con Vitest — los dos lugares que nos importa cachear.
 * Este archivo es un reemplazo mínimo, sin depender del runtime de Next:
 * un `Map` en memoria del proceso con una invalidación explícita.
 *
 * TTL corto como red de seguridad, no como mecanismo principal: el camino
 * normal es que `invalidate()` se llame desde toda mutación de `negocios`
 * (ver `portal/actions.ts` y `backoffice/actions.ts`). Si algún día aparece
 * una escritura que se olvida de invalidar, el TTL acota el daño a minutos
 * en vez de dejar una config vieja pegada indefinidamente.
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000;

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

/**
 * Devuelve el valor cacheado bajo `key` si no expiró; si no, corre `fn()`,
 * guarda el resultado (incluido `null`, para no repetir un "no existe") y lo
 * devuelve. No deduplica llamadas concurrentes para la misma key todavía en
 * vuelo — mismo criterio que el resto de los adaptadores del repo: reduce
 * carga, no es una garantía de exactamente-una-lectura bajo concurrencia.
 */
export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  const value = await fn();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

/**
 * Invalida TODO el caché de negocios. Llamar tras cualquier escritura a la
 * tabla `negocios` (crear, actualizar config/whatsapp/plan, pausar, borrar).
 * Se vacía entero en vez de por clave: son pocos negocios y las escrituras
 * son infrecuentes, así que no vale la pena el riesgo de una invalidación
 * parcial que se olvide de una de las dos claves (slug y phone_number_id)
 * de un mismo negocio.
 */
export function invalidateBusinessCache(): void {
  store.clear();
}
