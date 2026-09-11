/**
 * Esquema (Zod) del contrato JSON entre el motor y la IA en "modo agente".
 *
 * A diferencia de enhance()/extractDateTime() (que reformulan un borrador ya
 * decidido por el motor), acá es la IA quien decide QUÉ pasó en el turno:
 * qué datos capturar, si ya hay que confirmar, si el cliente se salió del
 * tema. `agent.ts` VALIDA cada acción contra el catálogo/estado real antes
 * de aplicarla al lead — nunca se confía a ciegas en lo que devuelve el
 * modelo, igual que con `parseExtractedDateTime`/`parseInterpretation`.
 */

import { z } from "zod";

const agentActionSchema = z.discriminatedUnion("tipo", [
  /** El cliente eligió (o cambió) de servicio. `servicioId` debe existir en el catálogo real. */
  z.object({ tipo: z.literal("elegir_servicio"), servicioId: z.string().min(1) }),
  /** El cliente dio su nombre. */
  z.object({ tipo: z.literal("guardar_nombre"), nombre: z.string().min(1) }),
  /** El cliente dio una fecha/hora tentativa. */
  z.object({ tipo: z.literal("guardar_fecha"), fecha: z.string().min(1) }),
  /** El cliente eligió una modalidad de entrega (retirar / comer en el local, etc.). */
  z.object({ tipo: z.literal("guardar_modalidad"), modalidad: z.string().min(1) }),
  /** Ya hay nombre + servicio + fecha (+ modalidad si aplica): confirmar la cita/pedido. */
  z.object({ tipo: z.literal("confirmar") }),
  /** El mensaje no tiene nada que ver con el negocio (charla ajena al contexto de venta). */
  z.object({ tipo: z.literal("fuera_de_contexto") }),
  /**
   * El cliente quiere empezar de cero o dice que los datos que tenemos están
   * mal ("yo no pedí nada", "cambié de idea", "empecemos de nuevo"). Borra
   * lo capturado — es la única forma que tiene la IA de CORREGIR un dato
   * viejo, porque las demás acciones solo agregan.
   */
  z.object({ tipo: z.literal("reiniciar") }),
]);

/**
 * Descarta del array crudo las entradas que NO cumplen `agentActionSchema`
 * antes de validarlo como array — así una acción alucinada (`{"tipo":
 * "hacer_magia"}`, o una a la que le falta un campo) no invalida el resto de
 * la respuesta. Si el valor no es un array, se devuelve sin tocar para que
 * `z.array` falle de forma normal (no es "algunas acciones raras", es un
 * campo con la forma equivocada).
 */
function descartarAccionesInvalidas(val: unknown): unknown {
  if (!Array.isArray(val)) return val;
  return val.filter((item) => agentActionSchema.safeParse(item).success);
}

export const agentResponseSchema = z.object({
  /** Texto para enviarle al cliente, ya redactado por la IA (no se reformula de nuevo). */
  respuesta: z.string().min(1),
  /**
   * Acciones que la IA cree que corresponden a este turno (pueden ser varias,
   * o ninguna). Tolerante: una acción con un "tipo" desconocido o un campo
   * faltante se descarta en vez de invalidar toda la respuesta — el resto de
   * `agent.ts` sigue validando cada acción que sobrevive contra el
   * catálogo/estado real, así que esto nunca relaja esas reglas de negocio.
   */
  acciones: z.preprocess(descartarAccionesInvalidas, z.array(agentActionSchema)).default([]),
});

export type AgentAction = z.infer<typeof agentActionSchema>;
export type AgentResponse = z.infer<typeof agentResponseSchema>;
