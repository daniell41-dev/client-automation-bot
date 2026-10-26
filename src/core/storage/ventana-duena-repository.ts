/**
 * T-59: cuándo le escribió la dueña por última vez al número del negocio.
 *
 * WhatsApp solo deja mandar texto libre a quien escribió en las últimas 24h;
 * fuera de esa ventana hace falta una plantilla aprobada. Meta no rechaza el
 * texto en el momento: lo acepta y DESPUÉS avisa que no lo entregó (T-58), así
 * que esperar el error para reintentar con plantilla no sirve. Hay que saber
 * de antemano si la ventana está abierta, y para eso se guarda este dato.
 */
export interface VentanaDuenaRepository {
  /** Anota que la dueña acaba de escribir. */
  registrarMensaje(negocio: string, cuando: Date): Promise<void>;
  /** ISO del último mensaje de la dueña, o `undefined` si nunca escribió. */
  ultimoMensaje(negocio: string): Promise<string | undefined>;
}

/**
 * ¿Se le puede mandar texto libre? Se deja media hora de margen sobre las 24h:
 * un aviso que sale justo al límite y llega un minuto tarde se perdería.
 */
export function ventanaAbierta(ultimoMensaje: string | undefined, ahora: Date): boolean {
  if (!ultimoMensaje) return false;
  const transcurrido = ahora.getTime() - new Date(ultimoMensaje).getTime();
  return transcurrido >= 0 && transcurrido < 23.5 * 60 * 60 * 1000;
}
