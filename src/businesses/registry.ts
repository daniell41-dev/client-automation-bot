/**
 * Registro de negocios.
 *
 * Mapea identificadores de plataforma → configuración del negocio. El webhook
 * resuelve el negocio por `phone_number_id`; el simulador lo resuelve por `slug`.
 *
 * Para dar de alta un negocio nuevo: impórtalo y agrégalo a los dos mapas.
 */

import type { BusinessConfig } from "@/core/types";
import { esteticaBella } from "@/businesses/estetica-bella/config";
import { restauranteSabores } from "@/businesses/restaurante-sabores/config";

/** Todos los negocios activos. */
const BUSINESSES: BusinessConfig[] = [esteticaBella, restauranteSabores];

/**
 * phone_number_id de WhatsApp → slug del negocio.
 * Rellena con los IDs reales de cada número de WhatsApp Business.
 */
const PHONE_NUMBER_ID_TO_SLUG: Record<string, string> = {
  // "111111111111111": "estetica-bella",
  // "222222222222222": "restaurante-sabores",
};

const BY_SLUG: Record<string, BusinessConfig> = Object.fromEntries(
  BUSINESSES.map((b) => [b.slug, b]),
);

/** Devuelve la config de un negocio por su slug, o `null`. */
export function getBusinessBySlug(slug: string): BusinessConfig | null {
  return BY_SLUG[slug] ?? null;
}

/** Devuelve la config de un negocio por el phone_number_id de WhatsApp, o `null`. */
export function getBusinessByPhoneNumberId(
  phoneNumberId: string,
): BusinessConfig | null {
  const slug = PHONE_NUMBER_ID_TO_SLUG[phoneNumberId];
  return slug ? getBusinessBySlug(slug) : null;
}

/** Lista de todos los negocios registrados. */
export function listBusinesses(): BusinessConfig[] {
  return [...BUSINESSES];
}
