/**
 * Interfaz intercambiable de pasarela de pago (T-24.5, Nivel 2 del plan de
 * pagos — `docs/15-plan-vision-tienda.md` §1.6/§4). Mismo criterio que
 * `ILLMProvider` (`core/ai/provider.ts`) y `ChannelAdapter`
 * (`core/channels/channel.ts`): el core no conoce Wompi, solo esta forma.
 */

export interface PaymentLinkRequest {
  /** Id del pedido (el lead) — Wompi lo devuelve tal cual en el webhook. */
  reference: string;
  amountInCents: number;
  currency: string;
  /** A dónde vuelve el cliente después de pagar. La confirmación real es el webhook, nunca esto. */
  redirectUrl?: string;
}

export interface PaymentGateway {
  /**
   * Arma la URL del checkout. Nunca hace una llamada de red: es una URL
   * firmada (integridad, no autenticación) que el cliente abre en su
   * navegador — la pasarela es quien cobra, el bot solo la genera.
   */
  buildPaymentLink(request: PaymentLinkRequest): string;
}
