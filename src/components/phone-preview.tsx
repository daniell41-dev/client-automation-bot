/**
 * Marco de teléfono con chat estilo WhatsApp (paleta del handoff, sin logos
 * de terceros). Reutilizable: los editores del portal lo alimentan con
 * mensajes derivados del estado del formulario (preview en vivo) y /demo lo
 * usa con mensajes reales del bot.
 */

import { Send } from "lucide-react";

/** Un turno del preview. */
export interface PreviewMessage {
  role: "in" | "out";
  text: string;
  /** Nota pequeña sobre la burbuja (p. ej. "Respondido con IA" o "Regla · 'horario'"). */
  note?: string;
}

/** Tarjeta de producto dentro del chat (catálogo). */
export interface PreviewProductCard {
  categoria?: string;
  nombre: string;
  precio: string;
  descripcion?: string;
  cta: string;
}

export function PhonePreview({
  botName,
  online = true,
  messages,
  productCard,
  quickReplies,
  footer,
  className,
}: {
  botName: string;
  /** false → "bot en pausa" en el header. */
  online?: boolean;
  messages: PreviewMessage[];
  productCard?: PreviewProductCard;
  quickReplies?: string[];
  /** Reemplaza la barra de input (p. ej. input real en /demo). */
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex w-[290px] shrink-0 flex-col overflow-hidden rounded-[34px] border-[6px] border-ink bg-wa-bg shadow-lift ${className ?? ""}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 bg-wa-header px-3.5 py-2.5 text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/25 text-xs font-bold">
          {botName.slice(0, 1).toUpperCase()}
        </span>
        <span className="leading-tight">
          <span className="block text-[13.5px] font-semibold">{botName}</span>
          <span className="block text-[11px] text-white/80">
            {online ? "en línea" : "bot en pausa"}
          </span>
        </span>
      </div>

      {/* Cuerpo */}
      <div className="flex min-h-[300px] flex-1 flex-col gap-2 overflow-y-auto px-2.5 py-3">
        <div className="self-center rounded-md bg-wa-today px-2 py-0.5 text-[10px] font-semibold text-ink-mid shadow-card">
          HOY
        </div>

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex flex-col ${m.role === "out" ? "items-end" : "items-start"}`}
          >
            {m.note && (
              <span className="mb-0.5 px-1 text-[9.5px] font-semibold text-ink-soft">
                {m.note}
              </span>
            )}
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-2.5 py-1.5 text-[12.5px] leading-snug text-ink shadow-card ${
                m.role === "out"
                  ? "rounded-br-[3px] bg-wa-out"
                  : "rounded-bl-[3px] bg-white"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {productCard && (
          <div className="w-[86%] self-end overflow-hidden rounded-lg bg-wa-out shadow-card">
            {/* Placeholder de imagen: rayado con la inicial. */}
            <div
              className="flex h-20 items-center justify-center text-2xl font-extrabold text-ink-soft"
              style={{
                background:
                  "repeating-linear-gradient(135deg,#e7e2d8 0 10px,#efeae2 10px 20px)",
              }}
            >
              {productCard.nombre.slice(0, 1).toUpperCase()}
            </div>
            <div className="space-y-0.5 px-2.5 py-2">
              {productCard.categoria && (
                <p className="text-[9.5px] font-bold uppercase tracking-wide text-wa-header">
                  {productCard.categoria}
                </p>
              )}
              <p className="text-[13px] font-bold leading-tight text-ink">
                {productCard.nombre}
              </p>
              <p className="text-[13px] font-bold text-wa-header">
                {productCard.precio}
              </p>
              {productCard.descripcion && (
                <p className="text-[11px] leading-snug text-ink-mid">
                  {productCard.descripcion}
                </p>
              )}
            </div>
            <button
              type="button"
              className="w-full border-t border-black/5 bg-white/60 py-1.5 text-center text-[12px] font-semibold text-wa-reply"
            >
              {productCard.cta}
            </button>
          </div>
        )}

        {quickReplies && quickReplies.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {quickReplies.map((label) => (
              <span
                key={label}
                className="rounded-full bg-white px-3 py-1 text-[11.5px] font-semibold text-wa-reply shadow-card"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Barra de input */}
      {footer ?? (
        <div className="flex items-center gap-2 bg-surface-2 px-2.5 py-2">
          <span className="flex-1 rounded-full bg-white px-3 py-1.5 text-[12px] text-ink-soft">
            Escribí un mensaje…
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-wa-header text-white">
            <Send className="h-3.5 w-3.5" />
          </span>
        </div>
      )}
    </div>
  );
}
