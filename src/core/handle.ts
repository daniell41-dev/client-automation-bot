/**
 * Orquestación de un mensaje entrante.
 *
 * Ata las tres piezas del core: storage (buscar/guardar el lead) + motor
 * (decidir la respuesta). Es reutilizable por el webhook de WhatsApp y por el
 * simulador offline, así ambos ejecutan exactamente la misma lógica.
 *
 * Dos modos de IA (`config.ai.modo`, default "agente"):
 *   - "agente": la IA decide qué acciones corresponden al turno (elegir
 *     servicio, guardar datos, confirmar, detectar fuera de contexto) — ver
 *     `agent.ts`. Requiere `llm` + `sessionRepo` + una persona configurada
 *     para el canal; si algo falta, o si la IA falla, cae al motor
 *     determinista de siempre para ese mensaje (nunca se rompe la charla).
 *   - "guiado": el funnel de siempre, paso a paso, con la IA solo
 *     reformulando el tono de las plantillas (`enhance`).
 */

import type {
  BusinessConfig,
  IncomingMessage,
  Lead,
  OutgoingMessage,
  Service,
  SessionMemory,
} from "@/core/types";
import type { LeadRepository } from "@/core/storage/repository";
import type { SessionRepository } from "@/core/storage/session-repository";
import type { InventoryRepository } from "@/core/storage/inventory-repository";
import type { ComprobanteRepository } from "@/core/storage/comprobante-repository";
import type { PaymentGateway } from "@/core/payments/gateway";
import type { ILLMProvider } from "@/core/ai/provider";
import type { PaymentReceiptDescription } from "@/core/ai/payment-receipt-schema";
import type { CalendarApi } from "@/core/storage/adapters/google/calendar";
import { interpretableOptions, respond } from "@/core/engine/responder";
import { buscarProducto } from "@/core/engine/buscar-producto";
import { calcularSeñalesPago, type Señal } from "@/core/engine/señales-pago";
import { decidirAccionWompi, type EstadoWompi } from "@/core/engine/pago-wompi";
import { runAgentTurn } from "@/core/ai/agent";
import { buildCalendarEvent } from "@/core/engine/calendar-event";
import { validarCita } from "@/core/engine/horarios";
import { citaCumplida, cerrarCitaCumplida } from "@/core/engine/appointment-lifecycle";
import { pedidoFinalizado, cerrarPedidoFinalizado } from "@/core/engine/pedido-lifecycle";
import { inactivo, limpiarDatosCapturados, reseteablePorInactividad } from "@/core/engine/session-lifecycle";
import { resumenCarrito, totalCarrito } from "@/core/engine/flows/pedido";
import { interpretarRespuestaDueña } from "@/core/engine/approval";
import { transition } from "@/core/engine/lead-state";
import { DEFAULT_PEDIDO_CONFIRMADO, DEFAULT_PEDIDO_RECHAZADO } from "@/core/engine/responder";
import { DEFAULT_TIMEZONE } from "@/core/timezone";
import { render } from "@/core/engine/templating";

/**
 * Lo mínimo que necesita `handleIncoming` para avisarle a la dueña por
 * WhatsApp. `WhatsAppChannel` ya cumple esta forma (mismo `send`), así que el
 * webhook puede pasar el mismo canal que usa para responderle al cliente.
 */
export interface OwnerNotifier {
  send(message: OutgoingMessage): Promise<void>;
}

/**
 * Resultado de procesar un mensaje. `modo` dice quién redactó la respuesta
 * de verdad: "agente" (la IA decidió las acciones del turno) o "guiado" (el
 * funnel determinista, con o sin `enhance()` encima). `motivoFallback` solo
 * viene con contenido cuando el negocio SÍ tiene el modo agente configurado
 * pero este turno puntual no pudo usarlo — sin esto, un fallback silencioso
 * es indistinguible de un "guiado" configurado a propósito (ver
 * docs/13-modo-agente.md).
 */
export interface HandleResult {
  messages: OutgoingMessage[];
  modo: "agente" | "guiado";
  motivoFallback?: string;
}

/**
 * T-23.5: descarga la imagen de un `media_id` ya resuelto por el canal (ver
 * `channels/whatsapp/media.ts` para la implementación real de WhatsApp).
 * `handle.ts` no importa esa implementación directamente — se mantiene
 * agnóstico de canal, igual que `OwnerNotifier`/`CalendarApi` — y nunca
 * lanza: sin esto, un mensaje con foto cae al mensaje de respaldo.
 */
export type MediaDownloader = (
  mediaId: string,
) => Promise<{ base64: string; mimeType: string } | null>;

/** §1.5 del plan: nunca un error silencioso ni un mensaje vacío ante una imagen que no se pudo procesar. */
const FALLBACK_VISION = "No pude ver bien la imagen, ¿me dices el nombre o la referencia?";

/** §1.4 del plan: recetas/fórmulas médicas NUNCA se procesan en farmacias — regla dura, sin excepción. */
function esRubroFarmaceutico(rubro?: string): boolean {
  return /farmac/i.test(rubro ?? "");
}

const RECHAZO_RECIPE_MEDICO =
  "Por políticas de salud, las recetas o fórmulas médicas no se procesan por acá — ese trámite se hace en persona con la farmacia 🙏";

/** Precio formateado — duplicado a propósito (mismo criterio que responder.ts, agent-prompt.ts y flows/pedido.ts). */
function formatPrice(config: BusinessConfig, price: number): string {
  try {
    return new Intl.NumberFormat(config.locale ?? "es-CO", {
      style: "currency",
      currency: config.currency,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${price} ${config.currency}`;
  }
}

/**
 * T-23.5/§1.2: arma la respuesta según cuántos candidatos encontró
 * `buscarProducto` — 1 = afirma (match exacto por referencia), 2 o más =
 * propone y pregunta, 0 = pide el nombre o la referencia por texto. Nunca
 * inventa un producto que no está en `candidatos`.
 */
function responderBusquedaImagen(candidatos: Service[], config: BusinessConfig): string {
  if (candidatos.length === 0) {
    return "No encontré ese producto en el catálogo — ¿me dices el nombre o la referencia?";
  }
  if (candidatos.length === 1) {
    const [s] = candidatos;
    return `Sí, tenemos ${s.name} a ${formatPrice(config, s.price)}. ¿Cuántos querés?`;
  }
  const opciones = candidatos.map((s) => `- ${s.name} (${formatPrice(config, s.price)})`).join("\n");
  return `Encontré estas opciones parecidas:\n${opciones}\n¿Cuál es la que buscás?`;
}

/**
 * T-23.5: deja constancia en el historial de sesión SOLO EN TEXTO (nunca la
 * imagen — ver §1.3 del plan: se procesa en memoria y se descarta) y arma el
 * resultado. `resumenImagen` es lo que queda grabado del lado del cliente,
 * p. ej. `"[imagen] Toyota filtro de aceite"`.
 */
async function imageReply(
  message: IncomingMessage,
  texto: string,
  resumenImagen: string,
  sessionRepo: SessionRepository | undefined,
  now: Date,
): Promise<HandleResult> {
  if (sessionRepo) {
    const session = await getOrCreateSession(sessionRepo, message, false);
    session.history.push({ role: "user", text: resumenImagen, timestamp: message.timestamp });
    session.history.push({ role: "assistant", text: texto, timestamp: now.toISOString() });
    await sessionRepo.save(session);
  }
  return { messages: [{ to: message.from, text: texto }], modo: "guiado" };
}

/**
 * T-23.5: orquesta el turno completo de un mensaje CON imagen. Orden fijo:
 * descargar media -> `describeImage` -> bloqueo duro de récipe en
 * farmacéutico -> `buscarProducto` -> responder según cantidad de
 * candidatos. Cualquier fallo en el camino (descarga, descripción) cae al
 * `FALLBACK_VISION` — nunca rompe la conversación ni deja al cliente sin
 * respuesta.
 */
async function handleImageMessage(
  message: IncomingMessage,
  config: BusinessConfig,
  llm: ILLMProvider,
  sessionRepo: SessionRepository | undefined,
  mediaDownloader: MediaDownloader,
  now: Date,
): Promise<HandleResult> {
  const media = await mediaDownloader(message.image!.mediaId);
  if (!media) {
    return imageReply(message, FALLBACK_VISION, "[imagen] (no se pudo descargar)", sessionRepo, now);
  }

  const descripcion = await llm.describeImage?.({
    base64: media.base64,
    mimeType: media.mimeType,
    caption: message.text || undefined,
  });
  if (!descripcion) {
    return imageReply(message, FALLBACK_VISION, "[imagen] (no se pudo describir)", sessionRepo, now);
  }

  const resumenImagen = `[imagen] ${[descripcion.marca, descripcion.tipoProducto].filter(Boolean).join(" ")}`;

  if (descripcion.esRecipeMedico && esRubroFarmaceutico(config.rubro)) {
    return imageReply(message, RECHAZO_RECIPE_MEDICO, resumenImagen, sessionRepo, now);
  }

  const candidatos = buscarProducto(descripcion, config.services);
  const texto = responderBusquedaImagen(candidatos, config);
  return imageReply(message, texto, resumenImagen, sessionRepo, now);
}

/** Default si el negocio no configuró `messages.pedirComprobante` (T-24.4). */
const DEFAULT_PEDIR_COMPROBANTE =
  "Para confirmar tu pedido, hacé el pago y mandanos la foto del comprobante 📸";

/**
 * §1.6, no negociable: el cliente NUNCA se entera de "pago confirmado" acá —
 * solo que se lo pasamos a la dueña. La confirmación real llega recién
 * cuando ella responde (reusa `handleOwnerApproval`, sin cambios).
 */
function respuestaComprobanteRecibido(config: BusinessConfig): string {
  return `Recibí tu comprobante, se lo paso a ${config.name} para confirmar y te aviso 🙏`;
}

const FALLBACK_COMPROBANTE_ILEGIBLE =
  "No pude leer bien el comprobante — ¿me lo reenviás más claro, por favor?";

/**
 * T-24.4: orquesta el turno de un comprobante de pago. Orden fijo:
 * descargar media -> `describePaymentReceipt` -> calcular señales contra
 * los comprobantes previos del negocio -> guardar (best-effort: una
 * referencia repetida ya quedó capturada en las señales ANTES del intento
 * de guardado, así que un fallo acá no le oculta nada a la dueña) -> avisar
 * a la dueña con el resumen + señales, nunca confirmar nada al cliente.
 */
async function handlePaymentReceiptMessage(
  message: IncomingMessage,
  config: BusinessConfig,
  lead: Lead,
  llm: ILLMProvider,
  sessionRepo: SessionRepository | undefined,
  mediaDownloader: MediaDownloader,
  notifier: OwnerNotifier | undefined,
  comprobantes: ComprobanteRepository | undefined,
  negocioParaStock: string | undefined,
  now: Date,
): Promise<HandleResult> {
  const media = await mediaDownloader(message.image!.mediaId);
  if (!media) {
    return imageReply(
      message,
      FALLBACK_COMPROBANTE_ILEGIBLE,
      "[comprobante] (no se pudo descargar)",
      sessionRepo,
      now,
    );
  }

  const descripcion = await llm.describePaymentReceipt?.({
    base64: media.base64,
    mimeType: media.mimeType,
    caption: message.text || undefined,
  });
  if (!descripcion || descripcion.legible === "ilegible") {
    return imageReply(message, FALLBACK_COMPROBANTE_ILEGIBLE, "[comprobante] (ilegible)", sessionRepo, now);
  }

  const negocio = negocioParaStock ?? config.slug;
  const total = totalCarrito(lead.items ?? [], config.services);

  let señales: Señal[] = [];
  if (comprobantes) {
    try {
      const previos = await comprobantes.listar(negocio);
      señales = calcularSeñalesPago(
        descripcion,
        { total },
        {
          telefonoDestino: config.pagos?.telefonoDestino,
          comprobantesPrevios: previos.map((p) => ({
            referencia: p.referencia,
            contacto: p.leadId ?? "",
            creadoEn: p.creadoEn,
          })),
        },
        lead.id,
        now,
      );
      await comprobantes.crear({
        negocio,
        leadId: lead.id,
        referencia: descripcion.referencia,
        monto: descripcion.monto,
        moneda: descripcion.moneda,
        banco: descripcion.banco,
        fechaComprobante: descripcion.fechaISO,
        señales,
      });
    } catch (err) {
      console.error("[Pagos] no se pudo guardar el comprobante (las señales ya se calcularon igual):", err);
    }
  }

  if (notifier && config.notifyPhoneNumber) {
    await notifyOwner(lead, config, notifier, {
      pidiendoAprobacion: true,
      comprobante: { descripcion, señales },
    });
  }

  const resumenImagen = `[comprobante] ${[descripcion.banco, descripcion.referencia].filter(Boolean).join(" ")}`;
  return imageReply(message, respuestaComprobanteRecibido(config), resumenImagen, sessionRepo, now);
}

export async function handleIncoming(
  message: IncomingMessage,
  config: BusinessConfig,
  repo: LeadRepository,
  now: Date = new Date(),
  llm?: ILLMProvider,
  sessionRepo?: SessionRepository,
  calendar?: CalendarApi,
  notifier?: OwnerNotifier,
  /** T-21: repositorio de stock — sin él, un pedido se confirma sin validar inventario (comportamiento de antes del PR4). */
  inventory?: InventoryRepository,
  /** UUID real del negocio en Supabase, o su slug como fallback — ver `negocio` en `AiUsageEntry`. */
  negocioParaStock?: string,
  /** T-23.5: sin esto, un mensaje con foto cae directo al mensaje de respaldo (nunca al funnel de texto de una vez). */
  mediaDownloader?: MediaDownloader,
  /** T-24.4: sin esto, un comprobante de pago no se guarda ni se cruza contra señales (igual se le avisa a la dueña). */
  comprobantes?: ComprobanteRepository,
  /** T-24.5: sin esto, `config.pagos.wompi.enabled` no tiene efecto — el pedido cae al camino de antes (comprobante o SÍ/NO plano). */
  paymentGateway?: PaymentGateway,
): Promise<HandleResult> {
  let existing = await repo.findByContact(message.businessSlug, message.from);

  // T-23.5/T-24.4: un mensaje con imagen es un camino aparte, completamente
  // distinto del funnel de cita/pedido de texto. Dos sub-caminos según el
  // estado del lead: si el negocio pide comprobante (`config.pagos`) y el
  // pedido ya está "esperando_aprobacion", la foto es un COMPROBANTE DE PAGO
  // (T-24.4); si no, es una foto de PRODUCTO (T-23.5) — ninguno de los dos
  // toca el resto del ciclo de vida del lead ni lo persiste por sí solo.
  if (message.image) {
    const esperandoComprobante =
      existing !== null &&
      existing.stage === "esperando_aprobacion" &&
      config.pagos?.requiereComprobante === true &&
      (existing.items?.length ?? 0) > 0;

    if (esperandoComprobante && llm && mediaDownloader) {
      return handlePaymentReceiptMessage(
        message,
        config,
        existing!,
        llm,
        sessionRepo,
        mediaDownloader,
        notifier,
        comprobantes,
        negocioParaStock,
        now,
      );
    }
    if (llm && mediaDownloader) {
      return handleImageMessage(message, config, llm, sessionRepo, mediaDownloader, now);
    }
    return { messages: [{ to: message.from, text: FALLBACK_VISION }], modo: "guiado" };
  }

  // T-20: si la cita del lead ya se cumplió (pasó su fecha, o pasaron los 7
  // días sin fecha exacta), se cierra ANTES de que el agente o el motor
  // determinista vean el mensaje — así los dos caminos reciben al cliente
  // como alguien que vuelve, no como una cita pendiente de hace semanas.
  const seCerroPorCumplida =
    existing !== null && citaCumplida(existing, now, config.timezone ?? DEFAULT_TIMEZONE);
  if (existing && seCerroPorCumplida) {
    existing = cerrarCitaCumplida(existing, now);
  }

  // T-21/PR5: un pedido YA ACEPTADO por la dueña muere de una — a diferencia
  // de una cita, no hay "cuándo se entregó" que esperar (ver
  // `pedido-lifecycle.ts`). El próximo mensaje del cliente arranca de cero,
  // nunca ve el recordatorio de "pedido vigente".
  const seCerroPedido = existing !== null && pedidoFinalizado(existing);
  if (existing && seCerroPedido) {
    existing = cerrarPedidoFinalizado(existing, now);
  }

  // T-20: reinicio por inactividad (24h). Dos cosas separadas (ver
  // `session-lifecycle.ts`): el hilo de charla se vacía SIEMPRE que pasó el
  // umbral (se mide sobre `lastInboundAt`, existe con o sin IA); los datos
  // capturados solo se resetean si el lead quedó a medias — una cita ya
  // confirmada nunca se toca acá. El `!seCerroPorCumplida` evita pisar el
  // cierre de arriba: ese ya dejó al lead en "recurrente"/"inicio", y esta
  // limpieza (pensada para el que quedó a medias) lo mandaría a "nuevo".
  const reiniciarHilo = existing !== null && inactivo(existing.lastInboundAt, now);
  if (existing && reiniciarHilo && !seCerroPorCumplida && reseteablePorInactividad(existing)) {
    existing = { ...existing };
    limpiarDatosCapturados(existing);
  }

  // Para canales sin persona propia (ej. "mock"), se usa la de whatsapp como fallback.
  const persona = config.personas?.[message.channel] ?? config.personas?.whatsapp;
  const modoAgente = config.ai?.enabled !== false && (config.ai?.modo ?? "agente") === "agente";

  let result: ReturnType<typeof respond> | null = null;
  let usedAgent = false;
  let session: SessionMemory | undefined;
  let motivoFallback: string | undefined;

  if (modoAgente) {
    if (llm && sessionRepo && persona) {
      session = await getOrCreateSession(sessionRepo, message, reiniciarHilo);
      result = await runAgentTurn(existing, message, config, llm, persona, session.history, now);
      usedAgent = result !== null;
      if (!usedAgent) {
        motivoFallback = "la IA no devolvió un turno válido para este mensaje (ver logs)";
      }
    } else {
      motivoFallback = "faltan requisitos del modo agente (IA, sesión o persona configurada)";
    }
  }

  if (!result) {
    result = respond(existing, message, config, now);
  }

  // Red de seguridad del motor determinista (solo si NO se usó el agente:
  // el agente ya razona con IA, no necesita este segundo intento). El motor
  // no reconoció el mensaje — si hay IA, le pedimos que lo traduzca a una
  // opción real del negocio y corremos el motor de nuevo UNA sola vez con
  // esa traducción — nunca en bucle, y nunca aceptando algo inventado (ver
  // `parseInterpretation`).
  if (!usedAgent && result.unrecognized && llm) {
    const options = interpretableOptions(existing?.stage, config);
    if (options.length > 0) {
      try {
        const interpreted = await llm.interpret({
          text: message.text,
          options,
          stage: existing?.stage ?? "inicio",
          history: [],
        });
        if (interpreted) {
          result = respond(existing, { ...message, text: interpreted }, config, now);
        }
      } catch (err) {
        console.error("[AI] interpret falló, sigue con el fallback:", err);
      }
    }
  }

  const { lead } = result;
  let { messages } = result;

  // T-20: si ESTE turno capturó una fecha nueva (cambió respecto a la que
  // tenía el lead antes de procesar el mensaje), resolverla a ISO real y
  // validarla contra el horario de atención — ANTES de persistir, para que
  // ni el agente ni el motor determinista puedan dejar pasar una cita fuera
  // de horario. Corre para los dos modos: ambos escriben `lead.tentativeDate`
  // directo (`responder.ts`/`agent.ts`), así que comparar contra `existing`
  // alcanza sin necesidad de que cada uno avise por separado.
  const fechaNueva = lead.tentativeDate && lead.tentativeDate !== existing?.tentativeDate;
  if (fechaNueva && llm) {
    const timezone = config.timezone ?? DEFAULT_TIMEZONE;
    try {
      const startISO = await llm.extractDateTime({
        text: lead.tentativeDate!,
        nowISO: now.toISOString(),
        timezone,
      });
      // Sin ISO (fecha ambigua) no hay nada contra qué validar — se acepta
      // igual que antes de T-20; `scheduleConfirmedAppointment` deja la nota
      // de "agendar manualmente" si esto sigue sin resolverse al confirmar.
      lead.appointmentAt = startISO ?? undefined;
      if (startISO) {
        const service = config.services.find((s) => s.id === lead.serviceId);
        const resultado = validarCita(startISO, service?.durationMinutes ?? 0, config.horarios, timezone);
        if (!resultado.ok) {
          lead.stage = "esperando_fecha";
          lead.tentativeDate = undefined;
          lead.appointmentAt = undefined;
          messages = [{ to: message.from, text: resultado.alternativa }];
        }
      }
    } catch (err) {
      console.error("[AI] extractDateTime falló al validar el horario, sigue sin validar:", err);
    }
  }

  // Side-effects al CONFIRMAR (transición a datos_completos): agendar en el
  // calendario del negocio y avisarle a la dueña por WhatsApp. Se detecta la
  // transición, no el estado, para no repetirlos en mensajes posteriores.
  // Funciona igual para ambos modos: el agente también deja `lead.stage`
  // en "datos_completos" al confirmar (ver `agent.ts`). Se calcula DESPUÉS
  // de la validación de horario de arriba, que puede haber revertido el
  // stage a `esperando_fecha` si la cita no era válida.
  const justConfirmed =
    existing?.stage !== "datos_completos" && lead.stage === "datos_completos";
  if (justConfirmed) {
    // T-20: siempre, incluso sin `calendar`/`llm` (un negocio sin IA nunca va
    // a tener `appointmentAt`, pero necesita `confirmedAt` para que el cierre
    // automático de la cita — que a falta de fecha exacta se basa en "hace
    // cuántos días se confirmó" — funcione igual). Un pedido NUNCA llega acá
    // directo desde T-21/PR5 (pasa primero por `esperando_aprobacion`, ver
    // abajo) — este bloque queda tal cual estaba para la cita.
    lead.confirmedAt = now.toISOString();
    if (calendar && llm) {
      await scheduleConfirmedAppointment(lead, config, now, llm, calendar);
    }
    if (notifier && config.notifyPhoneNumber) {
      await notifyOwner(lead, config, notifier);
    }
  }

  // T-21/PR5: el cliente acaba de confirmar un PEDIDO — antes de avisarle a
  // la dueña, se valida/descuenta el stock (mismo criterio que el PR4, mudado
  // acá: ahora el "confirmado" real es que la dueña acepte, no que el
  // cliente diga "sí"). Si no alcanza, se REVIERTE lo que ya aplicó el motor
  // (determinista o agente) — nunca se le pide a la dueña que apruebe algo
  // que no se puede cumplir.
  const justRequestedApproval =
    existing?.stage !== "esperando_aprobacion" && lead.stage === "esperando_aprobacion";
  if (justRequestedApproval) {
    if (config.pagos?.wompi?.enabled && paymentGateway) {
      // T-24.5, Nivel 2: EL STOCK NO SE TOCA ACÁ — a diferencia de los otros
      // dos caminos, recién se descuenta cuando llega el webhook APPROVED
      // verificado (`handleWompiWebhookEvent`). Si se descontara ahora, un
      // pago que nunca se completa dejaría el stock reservado para siempre
      // sin que nadie lo libere.
      const total = totalCarrito(lead.items!, config.services);
      const link = paymentGateway.buildPaymentLink({
        reference: lead.id,
        amountInCents: Math.round(total * 100),
        currency: config.currency,
        redirectUrl: config.pagos.wompi.redirectUrl,
      });
      const resumenPedido = resumenCarrito(lead.items!, config.services, config);
      messages = [
        {
          to: message.from,
          text: `${resumenPedido}\n\nPagá acá para confirmar tu pedido: ${link}`,
        },
      ];
    } else {
      let stockOk = true;
      if (inventory) {
        const resultado = await inventory.decrementCart(
          negocioParaStock ?? config.slug,
          lead.items!.map((i) => ({ serviceId: i.serviceId, cantidad: i.cantidad })),
        );
        if (!resultado.ok) {
          stockOk = false;
          const nombres = (resultado.faltantes ?? [])
            .map((id) => config.services.find((s) => s.id === id)?.name ?? id)
            .join(", ");
          // Mismo criterio que `limpiarDatosCapturados`: reset de estado
          // manejado por el motor, no una transición del usuario — se asigna
          // directo en vez de pasar por `transition()`.
          lead.state = existing?.state ?? "interesado";
          lead.stage = "carrito_abierto";
          messages = [
            {
              to: message.from,
              text: `Uy, justo se nos acabó el stock de: ${nombres}. Ajustá la cantidad o elegí otra cosa y seguimos 🙏`,
            },
          ];
        }
      }

      if (stockOk) {
        if (config.pagos?.requiereComprobante) {
          // T-24.4: reemplaza el disparador de SÍ/NO plano — no se avisa a la
          // dueña todavía, se le pide el comprobante al cliente. Recién cuando
          // llega la foto (`handlePaymentReceiptMessage`) se le avisa a ella.
          const resumenPedido = resumenCarrito(lead.items!, config.services, config);
          const pedirTexto = render(config.messages.pedirComprobante ?? DEFAULT_PEDIR_COMPROBANTE, {
            nombre: lead.name ?? "",
          });
          messages = [{ to: message.from, text: [resumenPedido, pedirTexto].filter(Boolean).join("\n\n") }];
        } else if (notifier && config.notifyPhoneNumber) {
          await notifyOwner(lead, config, notifier, { pidiendoAprobacion: true });
        }
      }
    }
  }

  await repo.save(lead);

  if (usedAgent) {
    // La respuesta ya la redactó el agente: no se vuelve a reformular con
    // enhance(). Solo se persiste el historial para el contexto del próximo turno.
    if (session && sessionRepo) {
      session.history.push({ role: "user", text: message.text, timestamp: message.timestamp });
      for (const m of messages) {
        session.history.push({ role: "assistant", text: m.text, timestamp: now.toISOString() });
      }
      await sessionRepo.save(session);
    }
    return { messages, modo: "agente" };
  }

  // Modo guiado: con el "cerebro con IA" apagado, o sin persona/sessionRepo,
  // no se reformula (solo plantillas y reglas).
  if (!llm || !sessionRepo || !persona || config.ai?.enabled === false) {
    return { messages, modo: "guiado", motivoFallback };
  }

  const sessionParaEnhance = session ?? (await getOrCreateSession(sessionRepo, message, reiniciarHilo));

  sessionParaEnhance.history.push({
    role: "user",
    text: message.text,
    timestamp: message.timestamp,
  });

  const enhanced: OutgoingMessage[] = [];
  for (const msg of messages) {
    const text = await llm.enhance({
      businessName: config.name,
      persona,
      history: sessionParaEnhance.history,
      draftResponse: msg.text,
      stage: lead.stage,
      knowledge: config.ai?.knowledge,
    });
    enhanced.push({ ...msg, text });
    sessionParaEnhance.history.push({
      role: "assistant",
      text,
      timestamp: now.toISOString(),
    });
  }

  await sessionRepo.save(sessionParaEnhance);
  return { messages: enhanced, modo: "guiado", motivoFallback };
}

/**
 * Trae (o crea) la sesión del contacto y, si tocaba reiniciar el hilo por
 * inactividad (T-20), la devuelve con el historial vacío. Hay DOS lugares en
 * `handleIncoming` que necesitan la sesión (modo agente y `enhance()` del
 * guiado) — este helper evita que el reinicio del hilo quede cableado en uno
 * solo de los dos.
 */
async function getOrCreateSession(
  sessionRepo: SessionRepository,
  message: IncomingMessage,
  reiniciarHilo: boolean,
): Promise<SessionMemory> {
  const session = await sessionRepo.getOrCreate(
    message.businessSlug,
    message.from,
    message.channel,
  );
  if (reiniciarHilo) session.history = [];
  return session;
}

/**
 * Crea el evento de calendario para una cita recién confirmada.
 *
 * Resuelve la fecha (texto libre → ISO) con la IA y, si es válida, crea el
 * evento. Si la fecha es ambigua o la creación falla, NO rompe la conversación:
 * deja una nota en el lead (visible en el Sheet) para revisión manual.
 */
async function scheduleConfirmedAppointment(
  lead: Lead,
  config: BusinessConfig,
  now: Date,
  llm: ILLMProvider,
  calendar: CalendarApi,
): Promise<void> {
  const service = config.services.find((s) => s.id === lead.serviceId);
  if (!service || !lead.tentativeDate) return;

  const timezone = config.timezone ?? DEFAULT_TIMEZONE;
  try {
    // T-20: el turno que capturó la fecha ya la resolvió a ISO para
    // validarla contra el horario (ver el bloque `fechaNueva` en
    // `handleIncoming`) — se reusa ese resultado en vez de volver a llamar a
    // la IA por la misma fecha. Sigue resolviéndola acá como red de
    // seguridad (leads de antes de T-20, o algún camino que no haya pasado
    // por ese bloque).
    const startISO =
      lead.appointmentAt ??
      (await llm.extractDateTime({
        text: lead.tentativeDate,
        nowISO: now.toISOString(),
        timezone,
      }));
    if (!startISO) {
      lead.notes = `Cita sin fecha exacta: "${lead.tentativeDate}". Agendar manualmente.`;
      return;
    }
    lead.appointmentAt = startISO;
    const event = buildCalendarEvent(lead, service, startISO, timezone);
    await calendar.createEvent(event);
  } catch (err) {
    console.error("[Calendar] no se pudo agendar la cita:", err);
    lead.notes = `Error al agendar "${lead.tentativeDate}" en el calendario. Revisar manualmente.`;
  }
}

/**
 * Le avisa a la dueña/o por WhatsApp que se confirmó una cita/pedido.
 * No usa IA (mensaje interno, no de cara al cliente); si falla el envío no
 * rompe la conversación con el cliente, solo se registra el error.
 */
/** T-24.4: una línea legible con lo que se leyó del comprobante — nunca afirma que sea válido. */
function lineaComprobante(config: BusinessConfig, descripcion: PaymentReceiptDescription): string {
  const partes = [
    "Comprobante:",
    descripcion.banco,
    descripcion.referencia ? `ref ${descripcion.referencia}` : null,
    descripcion.monto !== undefined ? formatPrice(config, descripcion.monto) : null,
    descripcion.fechaISO ?? null,
  ].filter(Boolean);
  return partes.join(" ");
}

async function notifyOwner(
  lead: Lead,
  config: BusinessConfig,
  notifier: OwnerNotifier,
  opciones: {
    pidiendoAprobacion?: boolean;
    /** T-24.4: si viene, se le muestran a la dueña los datos leídos del comprobante y las señales de riesgo (§1.7) — nunca un veredicto de validez. */
    comprobante?: { descripcion: PaymentReceiptDescription; señales: Señal[] };
  } = {},
): Promise<void> {
  const service = config.services.find((s) => s.id === lead.serviceId);
  // T-21: un carrito (varios productos posibles) se resume aparte — no tiene
  // sentido reducirlo a "Servicio: <un nombre>" como una cita.
  const esPedido = (lead.items?.length ?? 0) > 0;
  const lines = [
    // T-21/PR5: un pedido todavía no está "confirmado" en este punto — recién
    // lo está cuando la dueña responde. El título no debe prometer de más.
    opciones.pidiendoAprobacion
      ? `🔔 ${config.name}: pedido nuevo, esperando tu aprobación`
      : `🔔 ${config.name}: confirmación nueva`,
    `Cliente: ${lead.name ?? lead.contact}`,
    esPedido ? resumenCarrito(lead.items!, config.services, config) : null,
    !esPedido && service
      ? `${config.pedidos?.enabled ? "Pedido" : "Servicio"}: ${service.name}`
      : null,
    lead.entrega ? `Modalidad: ${lead.entrega}` : null,
    !esPedido && lead.tentativeDate ? `Fecha/hora: ${lead.tentativeDate}` : null,
    opciones.comprobante ? lineaComprobante(config, opciones.comprobante.descripcion) : null,
    ...(opciones.comprobante?.señales.map((s) => `⚠️ ${s.detalle}`) ?? []),
    // T-21/PR5: instrucción explícita — es lo que el webhook interpreta como
    // la respuesta de la dueña a ESTE pedido (ver `handleOwnerApproval`).
    opciones.pidiendoAprobacion ? "Respondé SÍ para aceptarlo o NO para rechazarlo." : null,
  ].filter((line): line is string => Boolean(line));

  try {
    await notifier.send({ to: config.notifyPhoneNumber!, text: lines.join("\n") });
  } catch (err) {
    console.error("[Notify] no se pudo avisar a la dueña por WhatsApp:", err);
  }
}

/** Resultado de procesar la respuesta de la dueña a un aviso de pedido (T-21/PR5). */
export interface OwnerApprovalResult {
  /** Mensaje de vuelta a la dueña (acuse de qué se hizo con su respuesta). */
  ownerReply: OutgoingMessage;
  /** Mensaje al CLIENTE con el resultado. Ausente si no había nada pendiente o no se entendió la respuesta de la dueña. */
  customerReply?: OutgoingMessage;
}

/**
 * Procesa la respuesta de la dueña (SÍ/NO) a un pedido pendiente de
 * aprobación (T-21/PR5). El webhook la llama en vez de `handleIncoming`
 * cuando reconoce que el remitente es `config.notifyPhoneNumber` — nunca se
 * mezcla con el funnel de cliente.
 *
 * Con más de un pedido esperando aprobación a la vez, resuelve el MÁS VIEJO
 * (FIFO): todavía no hay forma de que la dueña elija explícitamente CUÁL
 * desde WhatsApp (ver "Qué NO cubre" del PR).
 */
export async function handleOwnerApproval(
  message: IncomingMessage,
  config: BusinessConfig,
  repo: LeadRepository,
  now: Date = new Date(),
): Promise<OwnerApprovalResult> {
  const decision = interpretarRespuestaDueña(message.text);
  if (!decision) {
    return {
      ownerReply: { to: message.from, text: "No te entendí — respondé SÍ o NO al pedido pendiente 🙏" },
    };
  }

  const pendientes = (await repo.list(config.slug)).filter(
    (l) => l.stage === "esperando_aprobacion",
  );
  if (pendientes.length === 0) {
    return {
      ownerReply: { to: message.from, text: "No hay ningún pedido pendiente de aprobación ahora mismo." },
    };
  }
  // FIFO: el que espera hace más tiempo tiene prioridad.
  pendientes.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  const lead = pendientes[0];
  const resumen = resumenCarrito(lead.items ?? [], config.services, config);
  const nombreVars = { nombre: lead.name ?? "" };

  if (decision === "aceptado") {
    lead.state = transition(lead.state, "pagado");
    lead.stage = "datos_completos";
    lead.confirmedAt = now.toISOString();
    await repo.save(lead);
    return {
      ownerReply: { to: message.from, text: `Listo, confirmado el pedido de ${lead.name ?? lead.contact} ✅` },
      customerReply: {
        to: lead.contact,
        text: [resumen, render(config.messages.pedidoConfirmado ?? DEFAULT_PEDIDO_CONFIRMADO, nombreVars)]
          .filter(Boolean)
          .join("\n\n"),
      },
    };
  }

  // Rechazado: mismo criterio que "reiniciar" — se limpia lo de ESTE pedido,
  // no toda la identidad del lead (mismo `id`/`contact`).
  lead.state = transition(lead.state, "perdido");
  lead.stage = "inicio";
  lead.serviceId = undefined;
  lead.items = undefined;
  await repo.save(lead);
  return {
    ownerReply: { to: message.from, text: `Marcado como rechazado el pedido de ${lead.name ?? lead.contact}.` },
    customerReply: {
      to: lead.contact,
      text: render(config.messages.pedidoRechazado ?? DEFAULT_PEDIDO_RECHAZADO, nombreVars),
    },
  };
}

/** Resultado de procesar un evento de Wompi ya verificado (T-24.5). */
export interface WompiWebhookResult {
  /** Ausente si el evento no requería avisarle nada al cliente (p. ej. PENDING, o ya estaba confirmado). */
  customerMessage?: OutgoingMessage;
}

/**
 * Procesa un evento de Wompi YA VERIFICADO (la firma se valida en el
 * webhook, antes de llegar acá — ver `verifyWompiSignature`). Reusa
 * `decidirAccionWompi` (puro) para la decisión y es la ÚNICA función que
 * toca stock/lead para este camino — nunca se llama dos veces para el mismo
 * pago gracias a la idempotencia de `decidirAccionWompi` (un lead ya
 * confirmado no vuelve a tocarse).
 *
 * Con `APPROVED`, el bot confirma y descuenta stock SIN intervención de la
 * dueña (§4 del plan: es el único camino donde eso está permitido, porque la
 * certeza acá es criptográfica, no un OCR). Si el stock ya no alcanza para
 * cuando llega el webhook (se vendió mientras tanto), no se confirma el
 * pedido — se avisa al cliente para resolverlo a mano, nunca en silencio.
 */
export async function handleWompiWebhookEvent(
  lead: Lead,
  config: BusinessConfig,
  estado: EstadoWompi,
  repo: LeadRepository,
  inventory: InventoryRepository | undefined,
  negocioParaStock: string | undefined,
  now: Date = new Date(),
): Promise<WompiWebhookResult> {
  const yaConfirmado = lead.stage === "datos_completos";
  const decision = decidirAccionWompi(estado, yaConfirmado);

  if (decision.accion === "ninguna") return {};

  if (decision.accion === "rechazar") {
    // Vuelve al carrito (no a "inicio"): a diferencia del rechazo de la
    // dueña, acá el cliente no hizo nada mal — el pago falló del lado de la
    // pasarela, tiene sentido dejarlo reintentar sin perder lo que tenía.
    lead.state = transition(lead.state, "perdido");
    lead.stage = "carrito_abierto";
    await repo.save(lead);
    return {
      customerMessage: {
        to: lead.contact,
        text: "Tu pago no se pudo procesar. Si querés, lo intentamos de nuevo o vemos otra forma de pago 🙏",
      },
    };
  }

  // "confirmar" (estado APPROVED verificado).
  if (inventory && lead.items) {
    const resultado = await inventory.decrementCart(
      negocioParaStock ?? config.slug,
      lead.items.map((i) => ({ serviceId: i.serviceId, cantidad: i.cantidad })),
    );
    if (!resultado.ok) {
      const nombres = (resultado.faltantes ?? [])
        .map((id) => config.services.find((s) => s.id === id)?.name ?? id)
        .join(", ");
      // No se confirma el lead: el pago YA se cobró pero no hay cómo
      // cumplirlo — queda tal cual para que la dueña lo resuelva a mano
      // (reembolso/reposición), nunca silencioso.
      return {
        customerMessage: {
          to: lead.contact,
          text: `Recibimos tu pago, pero justo se nos acabó el stock de: ${nombres}. Te contactamos para resolverlo 🙏`,
        },
      };
    }
  }

  lead.state = transition(lead.state, "pagado");
  lead.stage = "datos_completos";
  lead.confirmedAt = now.toISOString();
  await repo.save(lead);

  const resumen = resumenCarrito(lead.items ?? [], config.services, config);
  return {
    customerMessage: {
      to: lead.contact,
      text: [resumen, "¡Listo! Tu pago quedó confirmado ✅"].filter(Boolean).join("\n\n"),
    },
  };
}
