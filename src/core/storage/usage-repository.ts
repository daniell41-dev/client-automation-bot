/**
 * Medición de consumo de IA por negocio (T-07).
 *
 * Cada entrada es un DELTA a sumar sobre el contador del día — nunca el total
 * nuevo. Se llama una vez por cada intento real a un proveedor (incluidos los
 * que fallan y pasan al siguiente de la cadena, ver `ResilientProvider`) y
 * una vez más, con `fallbacks: 1` bajo `FALLBACK_PROVIDER_LABEL`, cuando se
 * agotó toda la cadena y el motor siguió sin IA (plantilla o motor
 * determinista).
 */
export interface AiUsageEntry {
  /**
   * Identifica al negocio: el UUID de `negocios.id` en el adaptador de
   * Supabase, o el slug en el fallback JSON local (que no tiene esa tabla).
   */
  negocio: string;
  proveedor: string;
  llamadas?: number;
  tokensIn?: number;
  tokensOut?: number;
  fallbacks?: number;
}

export interface AiUsageRepository {
  registrar(entry: AiUsageEntry): Promise<void>;
}
