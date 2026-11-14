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
 * T-87: las burbujas salen de `chat.tsx`, compartidas con "Así funciona" y
 * "Para qué negocios".
 * T-91: más parecido a un WhatsApp de verdad, dentro del mismo ciclo: la nota
 * de voz avanza mientras "se escucha", arriba dice "escribiendo…" y salen
 * los tres puntos antes de cada respuesta de Nexo, los checks del resumen se
 * ponen azules cuando el cliente lo lee y el monto que no cuadra se subraya.
 * Todo lo nuevo se superpone (posición absoluta o la misma celda de grid):
 * no reserva ni libera espacio, así que sigue sin mover nada.
 */

import { Send } from "lucide-react";
import { AvisoAmbar, Burbuja, ComprobanteMini, Escribiendo, HoraVisto, NotaVoz } from "@/components/landing/chat";

/** Para lectores de pantalla: la animación es decorativa, la historia va en una frase. */
const DESCRIPCION =
  "Ejemplo de un pedido por WhatsApp a las 10:47 p. m.: el cliente manda una nota de voz, Nexo responde con el resumen y el total de $45.000, el cliente confirma y envía un comprobante por $40.000, Nexo avisa que no cuadra y a la dueña le llega el pedido #128 para aprobar, rechazar o pedir el resto.";

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
            {/* "en línea" y "escribiendo…" en la misma celda: se turnan sin mover nada. */}
            <span className="grid text-[11px] text-white">
              <span className="tel-en-linea col-start-1 row-start-1">en línea</span>
              <span aria-hidden className="tel-escribiendo col-start-1 row-start-1">escribiendo…</span>
            </span>
          </span>
          <span className="font-display text-[12px] font-semibold text-white">10:47 p. m.</span>
        </div>

        {/* Cuerpo: todos los pasos ocupan su lugar desde el inicio. */}
        <div className="flex flex-col gap-2 px-2.5 py-3">
          <div className="self-center rounded-md bg-wa-today px-2 py-0.5 text-[10px] font-semibold text-ink-mid shadow-card">
            HOY
          </div>

          {/* 1. Nota de voz del cliente */}
          <NotaVoz progreso className="tel-paso tel-paso-1" />

          {/* 2. Resumen del negocio. Antes, los tres puntos ocupan su lugar
              (encima, sin espacio propio) mientras Nexo "escribe". */}
          <div className="relative flex flex-col">
            <Escribiendo className="tel-tecleo absolute right-0 top-0" />
            <Burbuja de="negocio" className="tel-paso tel-paso-2">
              {"Su pedido:\n2x Hamburguesa sencilla $36.000\n1x Gaseosa $4.000\nDomicilio $5.000\nTotal: $45.000\n¿Confirma su pedido?"}
              <HoraVisto hora="10:47 p. m." vistoClassName="tel-visto" />
            </Burbuja>
          </div>

          {/* 3. Confirma y manda el comprobante */}
          <Burbuja de="cliente" className="tel-paso tel-paso-3">
            Confirmo
          </Burbuja>
          <ComprobanteMini monto="$40.000" className="tel-paso tel-paso-4" />

          {/* 4. Nexo marca que no cuadra */}
          <AvisoAmbar className="tel-paso tel-paso-5">
            El comprobante dice{" "}
            <span className="relative inline-block">
              $40.000
              <span aria-hidden className="tel-subraya absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-warn-ink" />
            </span>
            , el pedido es $45.000.
          </AvisoAmbar>
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
