/**
 * T-82: el teléfono del hero cuenta en 12 segundos lo que hace Nexo: llega una
 * nota de voz a las 10:47 p. m., sale el resumen con el total, el cliente
 * confirma y manda un comprobante que no cuadra, Nexo lo marca y a la dueña
 * le llega el aviso con los tres botones. Después, 3 s quieto y vuelve a
 * empezar.
 *
 * Solo CSS (ver `.tel-paso-*` en globals.css): componente de servidor, cero
 * JavaScript en el navegador. Cada paso ocupa su lugar desde el primer
 * cuadro y solo cambia opacity/transform, así que nada empuja nada (CLS 0).
 * Con "reducir movimiento" se ve la conversación completa, quieta.
 *
 * El marco copia el de `phone-preview.tsx` (mismos tokens de WhatsApp); no se
 * reutiliza el componente porque ese pinta mensajes de texto, y aquí hay una
 * nota de voz, un comprobante y una tarjeta que sale del borde.
 */

import { Send } from "lucide-react";

/** Para lectores de pantalla: la animación es decorativa, la historia va en una frase. */
const DESCRIPCION =
  "Ejemplo de un pedido por WhatsApp a las 10:47 p. m.: el cliente manda una nota de voz, Nexo responde con el resumen y el total de $45.000, el cliente confirma y envía un comprobante por $40.000, Nexo avisa que no cuadra y a la dueña le llega el pedido #128 para aprobar, rechazar o pedir el resto.";

/** Alturas de la onda de la nota de voz (px). Fijas: la misma forma en cada render. */
const ONDA = [6, 10, 14, 9, 16, 12, 7, 13, 18, 11, 8, 15, 10, 6, 12, 9, 14, 7];

export function TelefonoAnimado() {
  return (
    // pb: reserva el lugar de la tarjeta flotante, que sobresale por abajo. Solo
    // monta sobre la barra de escribir: nunca tapa la etiqueta ámbar, que es
    // el mensaje que importa.
    <div role="img" aria-label={DESCRIPCION} className="relative w-full max-w-[290px] pb-[102px] lg:pb-[100px]">
      <div aria-hidden className="flex flex-col overflow-hidden rounded-[34px] border-[6px] border-ink bg-wa-bg shadow-lift">
        {/* Encabezado del chat */}
        <div className="flex items-center gap-2.5 bg-wa-header px-3.5 py-2.5 text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/25 text-xs font-bold">S</span>
          <span className="flex-1 leading-tight">
            <span className="block text-[13.5px] font-semibold">Su negocio</span>
            <span className="block text-[11px] text-white">en línea</span>
          </span>
          <span className="font-display text-[12px] font-semibold text-white">10:47 p. m.</span>
        </div>

        {/* Cuerpo: todos los pasos ocupan su lugar desde el inicio. */}
        <div className="flex flex-col gap-2 px-2.5 py-3">
          <div className="self-center rounded-md bg-wa-today px-2 py-0.5 text-[10px] font-semibold text-ink-mid shadow-card">
            HOY
          </div>

          {/* 1. Nota de voz del cliente */}
          <div className="tel-paso tel-paso-1 flex max-w-[78%] items-center gap-2 self-start rounded-lg rounded-bl-[3px] bg-white px-2.5 py-2 shadow-card">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-wa-header">
              <span className="ml-0.5 h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-white" />
            </span>
            <span className="flex h-[18px] items-center gap-[2px]">
              {ONDA.map((alto, i) => (
                <span key={i} className="w-[2px] rounded-full bg-ink-soft" style={{ height: alto }} />
              ))}
            </span>
            <span className="font-display text-[11px] font-semibold text-ink-mid">0:08</span>
          </div>

          {/* 2. Resumen del negocio */}
          <div className="tel-paso tel-paso-2 max-w-[86%] self-end whitespace-pre-line rounded-lg rounded-br-[3px] bg-wa-out px-2.5 py-1.5 text-[12.5px] leading-snug text-ink shadow-card">
            {"Su pedido:\n2x Hamburguesa sencilla $36.000\n1x Gaseosa $4.000\nDomicilio $5.000\nTotal: $45.000\n¿Confirma su pedido?"}
          </div>

          {/* 3. Confirma y manda el comprobante */}
          <div className="tel-paso tel-paso-3 self-start rounded-lg rounded-bl-[3px] bg-white px-2.5 py-1.5 text-[12.5px] text-ink shadow-card">
            Confirmo
          </div>
          <div className="tel-paso tel-paso-4 w-[58%] self-start rounded-lg rounded-bl-[3px] bg-white p-1.5 shadow-card">
            {/* Comprobante genérico: sin logos de bancos ni datos reales. */}
            <div className="rounded-md border border-line bg-surface-3 px-2.5 py-2">
              <p className="text-[9.5px] font-bold uppercase tracking-wide text-ink-mid">Comprobante</p>
              <p className="font-display text-[17px] font-bold text-ink">$40.000</p>
              <span className="mt-1 block h-1.5 w-4/5 rounded-full bg-line-2" />
              <span className="mt-1 block h-1.5 w-3/5 rounded-full bg-line-2" />
            </div>
          </div>

          {/* 4. Nexo marca que no cuadra */}
          <p className="tel-paso tel-paso-5 self-center rounded-md bg-warn-bg px-2.5 py-1 text-center text-[11px] font-semibold leading-snug text-warn-ink shadow-card">
            El comprobante dice $40.000, el pedido es $45.000.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-surface-2 px-2.5 py-2">
          <span className="flex-1 rounded-full bg-white px-3 py-1.5 text-[12px] text-ink-mid">Escriba un mensaje…</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-wa-header text-white">
            <Send className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>

      {/* 5. Aviso a la dueña: sale del borde del teléfono. En móvil queda dentro
          del ancho del teléfono (sin scroll horizontal); en escritorio asoma por la izquierda. */}
      <div
        aria-hidden
        className="tel-paso tel-paso-6 absolute bottom-0 left-3 right-3 rounded-2xl border border-line bg-surface p-3 shadow-lift lg:-left-20 lg:right-auto lg:w-[250px]"
      >
        <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Para usted</p>
        <p className="mt-0.5 text-[13.5px] font-bold text-ink">
          Pedido <span className="font-display">#128</span> · Revise el comprobante
        </p>
        <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center text-[11.5px] font-bold">
          <span className="rounded-lg bg-primary py-1.5 text-white">Aprobar</span>
          <span className="rounded-lg border border-line-input py-1.5 text-ink">Rechazar</span>
          <span className="rounded-lg border border-line-input py-1.5 text-ink">Pedir resto</span>
        </div>
      </div>
    </div>
  );
}
