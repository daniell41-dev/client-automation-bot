/**
 * Datos de cobro del negocio y normalización de lo que se compara contra un
 * comprobante (T-33).
 *
 * Funciones puras: las usa `handle.ts` para decirle al cliente A DÓNDE pagar
 * (antes el bot pedía "hacé el pago" sin dar ningún número) y
 * `señales-pago.ts` para comparar referencias y teléfonos sin que un espacio o
 * un "+57" disparen una alarma falsa.
 */

import type { CuentaPago, PagosConfig, TipoCuentaPago } from "@/core/types";

/**
 * Líneas con los datos de pago del negocio, listas para el mensaje al
 * cliente. Vacío si el negocio no cargó ninguno.
 */
export function textoDatosPago(datos: PagosConfig["datosPago"]): string {
  if (!datos) return "";
  return [
    datos.nequi?.trim() ? `Nequi: ${datos.nequi.trim()}` : null,
    datos.llaveBreB?.trim() ? `Llave Bre-B: ${datos.llaveBreB.trim()}` : null,
    datos.titular?.trim() ? `A nombre de: ${datos.titular.trim()}` : null,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

const TIPO_CUENTA: Record<TipoCuentaPago, string> = {
  ahorros: "Cuenta de ahorros",
  corriente: "Cuenta corriente",
  billetera: "Celular",
  llave: "Llave Bre-B",
};

/** Un bloque por cuenta: entidad, tipo + número y titular, en líneas cortas que se leen bien en WhatsApp. */
function textoCuenta(cuenta: CuentaPago): string {
  const titular = cuenta.titular?.trim();
  const documento = cuenta.documento?.trim();
  return [
    `*${cuenta.entidad.trim()}*`,
    `${TIPO_CUENTA[cuenta.tipo]}: ${cuenta.numero.trim()}`,
    titular ? `A nombre de: ${titular}${documento ? ` (${documento})` : ""}` : null,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

/**
 * T-45: los datos de pago que el bot le da al cliente. Con `cuentas`, una
 * por bloque; sin ellas, el formato viejo de `datosPago` (un solo Nequi), así
 * los negocios configurados antes de T-45 siguen funcionando sin tocarlos.
 */
export function textoCuentasPago(pagos: PagosConfig | undefined): string {
  const cuentas = (pagos?.cuentas ?? []).filter((c) => c.numero.trim());
  if (cuentas.length > 0) return cuentas.map(textoCuenta).join("\n\n");
  return textoDatosPago(pagos?.datosPago);
}

/**
 * T-45: las cuentas para mostrar en el editor. Un negocio configurado antes
 * de T-45 tiene el Nequi y la llave Bre-B sueltos en `datosPago`; se
 * convierten a cuentas para que la dueña los vea y los guarde con el formato
 * nuevo sin volver a escribirlos.
 */
export function cuentasDeConfig(pagos: PagosConfig | undefined): CuentaPago[] {
  if (pagos?.cuentas?.length) return pagos.cuentas;
  const titular = pagos?.datosPago?.titular?.trim() || undefined;
  const nequi = pagos?.datosPago?.nequi?.trim() || pagos?.telefonoDestino?.trim();
  const llave = pagos?.datosPago?.llaveBreB?.trim();
  const cuentas: CuentaPago[] = [];
  if (nequi) cuentas.push({ entidad: "Nequi", tipo: "billetera", numero: nequi, ...(titular ? { titular } : {}) });
  if (llave) cuentas.push({ entidad: "Bre-B", tipo: "llave", numero: llave, ...(titular ? { titular } : {}) });
  return cuentas;
}

/**
 * T-45: todos los números donde el negocio recibe plata, para la señal
 * "destino no coincide". Con una sola cuenta registrada, un cliente que le
 * pagaba a la otra (Bancolombia en vez de Nequi) disparaba una alarma falsa.
 */
export function destinosDePago(pagos: PagosConfig | undefined): string[] {
  return [
    pagos?.telefonoDestino,
    pagos?.datosPago?.nequi,
    ...(pagos?.cuentas ?? []).map((c) => c.numero),
  ].filter((n): n is string => Boolean(n?.trim()));
}

/**
 * Referencia comparable: sin espacios ni guiones, en mayúsculas. La IA
 * transcribe lo que ve, y el mismo comprobante puede leerse "M 0834-12" una
 * vez y "M083412" otra; sin esto, un comprobante reciclado pasaba la
 * detección de "referencia repetida".
 */
export function normalizarReferencia(referencia: string | undefined): string | undefined {
  if (!referencia) return undefined;
  const limpia = referencia.replace(/[\s-]+/g, "").toUpperCase();
  return limpia || undefined;
}

/**
 * Teléfono comparable: solo dígitos y, si es más largo, los últimos 10 (un
 * celular colombiano). Así "+57 300 123 4567", "573001234567" y
 * "300-123-4567" son el mismo número. Un comprobante que muestra el número
 * enmascarado ("***4567") no se puede comparar: devuelve `undefined` y la
 * señal no se dispara, en vez de dar una alarma falsa.
 */
export function normalizarTelefono(telefono: string | undefined): string | undefined {
  if (!telefono || /[*xX•]/.test(telefono)) return undefined;
  const digitos = telefono.replace(/\D/g, "");
  if (digitos.length < 7) return undefined;
  return digitos.length > 10 ? digitos.slice(-10) : digitos;
}
