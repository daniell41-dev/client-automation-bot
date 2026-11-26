import { textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (acciones.validarContrasena). */
const tt = textos.acciones.validarContrasena;
/**
 * Reglas de una contraseña nueva (T-41). Función pura para poder testearla:
 * la misma regla vale para la invitación y para "olvidé mi contraseña".
 */
export function validarNuevaContrasena(contrasena: string, repetida: string): string | null {
  if (contrasena.length < 8) return tt.laContrasenaTieneQue;
  if (contrasena !== repetida) return tt.lasDosContrasenasNo;
  return null;
}
