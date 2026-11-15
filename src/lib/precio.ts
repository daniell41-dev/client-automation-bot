/**
 * T-89: el precio "desde" de la landing ("$79.900") como número, para los
 * datos estructurados (schema.org Offer pide `price` numérico). En pesos
 * colombianos no hay centavos: los puntos son de miles. `null` si no hay
 * precio o si el texto no trae ningún número (no se inventa un 0).
 */
export function precioNumerico(texto: string | null | undefined): number | null {
  const digitos = (texto ?? "").replace(/\D/g, "");
  return digitos ? Number(digitos) : null;
}
