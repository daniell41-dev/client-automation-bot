/**
 * Precio legible para el cliente y la dueña, en la moneda del negocio.
 *
 * T-153: Intl escribe el bolívar como "VES 3.850" (con es-CO) o "Bs.S 3.850"
 * (con es-VE, el nombre de antes de la reconversión de 2021). En Venezuela
 * se escribe "Bs. 3.850": ese sale fijo.
 */
export function formatoPrecio(monto: number, moneda: string, locale = "es-CO"): string {
  try {
    if (moneda === "VES") {
      return `Bs. ${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(monto)}`;
    }
    return new Intl.NumberFormat(locale, { style: "currency", currency: moneda, maximumFractionDigits: 0 }).format(monto);
  } catch {
    return `${monto} ${moneda}`;
  }
}
