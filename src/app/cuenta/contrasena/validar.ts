/**
 * Reglas de una contraseña nueva (T-41). Función pura para poder testearla:
 * la misma regla vale para la invitación y para "olvidé mi contraseña".
 */
export function validarNuevaContrasena(contrasena: string, repetida: string): string | null {
  if (contrasena.length < 8) return "La contraseña tiene que tener al menos 8 caracteres.";
  if (contrasena !== repetida) return "Las dos contraseñas no coinciden.";
  return null;
}
