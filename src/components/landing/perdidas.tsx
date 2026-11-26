/**
 * T-80: el problema en escenas que la dueña ya vivió, sin cifras que no
 * podemos respaldar.
 * T-84: en vez de tres tarjetas iguales, dos columnas. A la izquierda, el
 * problema pasando: un cliente que escribe de noche, insiste y se va. A la
 * derecha, lo que eso cuesta, en tres frases grandes sin adornos.
 *
 * El chat usa las burbujas del teléfono del hero (mismos tokens de WhatsApp),
 * pero sin marco: no es una demo del producto, es lo que pasa sin él.
 */

import { Seccion } from "@/components/landing/seccion";
import { textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (landing.perdidas). */
const tt = textos.landing.perdidas;

/** Mensajes del cliente que nadie contestó. Horas visiblemente de ejemplo. */
const SIN_RESPUESTA = [
  { texto: tt.todaviaTienenDomicilio, hora: "9:52 p. m." },
  { texto: tt.hola, hora: "10:15 p. m." },
  { texto: tt.yaPediEnOtro, hora: "10:31 p. m." },
];

const PERDIDAS = [
  tt.elClienteQueEscribio,
  tt.elTotalMalSumado,
  tt.elComprobanteQueYa,
];

export function Perdidas() {
  return (
    <Seccion id="perdidas" titulo={tt.loQueSePierde}>
      <div className="mt-10 grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Izquierda: el chat que nadie respondió. */}
        <div>
          <ol aria-label={tt.mensajesDeUnCliente} className="flex flex-col items-start gap-2.5">
            {SIN_RESPUESTA.map((m) => (
              <li
                key={m.hora}
                className="flex max-w-[85%] items-end gap-3 rounded-lg rounded-bl-[3px] bg-surface px-3.5 py-2.5 text-[16px] leading-snug text-ink shadow-card"
              >
                <span>{m.texto}</span>
                <time className="shrink-0 font-display text-[12px] font-semibold text-ink-mid">{m.hora}</time>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-[14px] text-ink-mid">{tt.vistoPorUltimaVez}</p>
        </div>

        {/* Derecha: lo que cuesta. Sin tarjeta ni icono: la frase sola. */}
        <ul className="divide-y divide-line-2">
          {PERDIDAS.map((frase) => (
            <li key={frase} className="py-5 text-[24px] font-extrabold leading-tight text-ink first:pt-0 last:pb-0 sm:text-[28px]">
              {frase}
            </li>
          ))}
        </ul>
      </div>
    </Seccion>
  );
}
