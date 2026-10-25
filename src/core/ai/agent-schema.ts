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
  /** T-36: la dirección de entrega de un pedido a domicilio. */
  z.object({ tipo: z.literal("guardar_direccion"), direccion: z.string().min(1) }),
  /**
   * T-21: el cliente dio la cantidad de UN producto del pedido (no una cita).
   * `servicioId` debe ser un ítem de modo "pedido" del catálogo real —
   * `agent.ts` lo valida igual que `elegir_servicio`.
   */
  z.object({
    tipo: z.literal("guardar_cantidad"),
    servicioId: z.string().min(1),
    cantidad: z.number().positive(),
  }),
  /** Ya hay nombre + servicio + fecha (+ modalidad si aplica), o nombre + carrito con algo: confirmar la cita/pedido. */
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
  return val.map(normalizarAccion).filter((item) => {
    const ok = agentActionSchema.safeParse(item).success;
    // T-54: antes se descartaban en silencio — así se perdían el nombre y el
    // carrito en las pruebas reales sin ningún rastro en la terminal.
    if (!ok) console.warn("[Agent] acción descartada por no cumplir el contrato:", JSON.stringify(item));
    return ok;
  });
}

/** T-54: nombres alternativos que usan los modelos para cada campo del contrato. */
const ALIAS_CAMPOS: Record<string, string[]> = {
  servicioId: ["servicio_id", "servicio", "serviceId", "service_id", "productoId", "producto_id", "producto", "itemId", "id"],
  nombre: ["name", "valor", "value", "cliente"],
  fecha: ["date", "valor", "value"],
  modalidad: ["entrega", "opcion", "valor", "value"],
  direccion: ["address", "valor", "value"],
  cantidad: ["qty", "quantity", "unidades", "valor", "value"],
};

const CAMPOS_POR_TIPO: Record<string, string[]> = {
  elegir_servicio: ["servicioId"],
  guardar_nombre: ["nombre"],
  guardar_fecha: ["fecha"],
  guardar_modalidad: ["modalidad"],
  guardar_direccion: ["direccion"],
  guardar_cantidad: ["servicioId", "cantidad"],
};

/**
 * T-54: completa el campo que espera el contrato cuando el modelo lo mandó
 * con otro nombre (`{"tipo":"guardar_nombre","valor":"Valero"}`) y pasa a
 * número una cantidad escrita como texto ("2"). Solo renombra: el valor se
 * sigue validando contra el catálogo y el estado real en `agent.ts`.
 */
function normalizarAccion(item: unknown): unknown {
  if (!item || typeof item !== "object") return item;
  const accion = { ...(item as Record<string, unknown>) };
  for (const campo of CAMPOS_POR_TIPO[String(accion.tipo)] ?? []) {
    if (accion[campo] === undefined) {
      const alias = ALIAS_CAMPOS[campo]?.find((a) => accion[a] !== undefined);
      if (alias) accion[campo] = accion[alias];
    }
  }
  if (typeof accion.cantidad === "string" && /^\d+$/.test(accion.cantidad.trim())) {
    accion.cantidad = Number(accion.cantidad);
  }
  return accion;
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
