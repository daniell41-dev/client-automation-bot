/**
 * T-80: lo primero que ve la dueña: qué hace Nexo, en una frase que se
 * entienda sin saber de tecnología.
 * T-82: el teléfono cuenta la historia completa en movimiento (nota de voz,
 * resumen, comprobante que no cuadra y aviso para aprobar), y las tres
 * condiciones que más frenan la compra van a la vista debajo de los botones.
 *
 * El video es opcional: si alguien sube `public/landing/demo.mp4`, reemplaza
 * al teléfono en el próximo build. Se revisa al compilar (la página es
 * estática), así que no hay un <video> roto mientras el archivo no exista.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { Check } from "lucide-react";
import { BotonWhatsApp } from "@/components/landing/boton-whatsapp";
import { TelefonoAnimado } from "@/components/landing/telefono-animado";

export const SUBTITULO_HERO =
  "Nexo responde a sus clientes a cualquier hora, arma el pedido con el total, revisa el comprobante de pago y usted aprueba con un botón. Se lo instalamos aquí en Cúcuta.";

/** Las mismas condiciones que la sección de precio y los Términos: no prometer otra cosa aquí. */
const CONDICIONES = ["Instalación gratis", "14 días de prueba", "Sin permanencia"];

const VIDEO = "/landing/demo.mp4";
const POSTER = "/landing/demo.jpg";

function existeEnPublic(ruta: string): boolean {
  return existsSync(join(process.cwd(), "public", ruta));
}

export function Hero() {
  const hayVideo = existeEnPublic(VIDEO);
  const hayPoster = existeEnPublic(POSTER);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-10 pt-6 sm:px-6 sm:pb-16 sm:pt-10">
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_290px] lg:gap-14">
        <div className="fade-up">
          <h1 className="text-[38px] font-extrabold leading-[1.08] text-white sm:text-[46px] lg:text-[52px]">
            Su WhatsApp toma pedidos aunque usted esté en la cocina.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75 sm:text-[17px]">{SUBTITULO_HERO}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <BotonWhatsApp origen="hero" />
            <Link
              href="/demo"
              className="inline-flex min-h-12 items-center justify-center rounded-[10px] border border-white/25 px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
            >
              Pruebe la demo
            </Link>
          </div>
          <ul className="mt-6 flex flex-wrap gap-2">
            {CONDICIONES.map((c) => (
              <li
                key={c}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-[13px] font-semibold text-white/85"
              >
                <Check className="h-3.5 w-3.5 text-success" aria-hidden />
                {c}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-center lg:justify-end">
          {hayVideo ? (
            <video
              className="w-full max-w-[290px] rounded-[34px] border-[6px] border-ink shadow-lift"
              src={VIDEO}
              poster={hayPoster ? POSTER : undefined}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-label="Video de un pedido por WhatsApp atendido por Nexo"
            />
          ) : (
            <TelefonoAnimado />
          )}
        </div>
      </div>
    </section>
  );
}
