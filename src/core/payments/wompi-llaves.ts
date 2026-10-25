/**
 * T-49: forma de las llaves de Wompi. En la prueba real, el navegador
 * autocompletó el formulario con el correo y la contraseña de la dueña, y
 * nada impedía guardarlos como si fueran llaves. Wompi les pone un prefijo
 * fijo a cada una, así que alcanza con mirarlo para rechazar lo que claramente
 * no es una llave.
 */

export type CampoWompi = "public_key" | "integrity_secret" | "events_secret";

const PREFIJOS: Record<CampoWompi, RegExp> = {
  public_key: /^pub_(prod|test)_[A-Za-z0-9]+$/,
  integrity_secret: /^(prod|test)_integrity_[A-Za-z0-9]+$/,
  events_secret: /^(prod|test)_events_[A-Za-z0-9]+$/,
};

const NOMBRES: Record<CampoWompi, string> = {
  public_key: "La llave pública (empieza con pub_prod_ o pub_test_)",
  integrity_secret: "El secreto de integridad (empieza con prod_integrity_ o test_integrity_)",
  events_secret: "El secreto de eventos (empieza con prod_events_ o test_events_)",
};

/** `null` si el valor tiene forma de llave de Wompi; si no, el mensaje para la dueña. */
export function errorLlaveWompi(campo: CampoWompi, valor: string): string | null {
  return PREFIJOS[campo].test(valor) ? null : `${NOMBRES[campo]} no tiene el formato de Wompi. Copiala de tu panel de Wompi.`;
}
