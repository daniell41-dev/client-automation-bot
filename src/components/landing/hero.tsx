/**
 * T-80: lo primero que ve la dueña: qué hace Nexo, en una frase que se
 * entienda sin saber de tecnología, y la conversación real de un pedido.
 *
 * El video es opcional: si alguien sube `public/landing/demo.mp4`, reemplaza
 * al teléfono en el próximo build. Se revisa al compilar (la página es
 * estática), así que no hay un <video> roto mientras el archivo no exista.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { PhonePreview, type PreviewMessage } from "@/components/phone-preview";
import { BotonWhatsApp } from "@/components/landing/boton-whatsapp";

export const SUBTITULO_HERO =
  "Nexo responde a sus clientes a cualquier hora con su menú y sus precios, arma el pedido con el total, revisa el comprobante de pago y le deja a usted la última palabra. Se lo instalamos aquí en Cúcuta.";

/** Cliente = "in" (burbuja blanca), negocio = "out" (verde), igual que en los editores del portal. */
const CONVERSACION: PreviewMessage[] = [
  { role: "in", text: "Buenas, 2 hamburguesas sencillas y una gaseosa a domicilio" },
  { role: "out", text: "¡Con gusto! ¿A qué dirección se lo llevamos?" },
  { role: "in", text: "Av. 4 #12-30, La Riviera" },
  {
    role: "out",
    text: "Su pedido:\n2x Hamburguesa sencilla $36.000\n1x Gaseosa $4.000\nDomicilio $5.000\nTotal: $45.000\n¿Confirma su pedido?",
  },
  { role: "in", text: "Confirmo" },
];

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
          <h1 className="text-[32px] font-extrabold leading-[1.1] text-white sm:text-[46px] lg:text-[52px]">
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
            <PhonePreview botName="Su negocio" messages={CONVERSACION} />
          )}
        </div>
      </div>

      <ul className="mt-12 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center text-[13px] font-semibold text-white/60 sm:text-sm">
        <li>Conexión oficial para empresas</li>
        <li aria-hidden>·</li>
        <li>Instalación en persona</li>
        <li aria-hidden>·</li>
        <li>Hecho en Cúcuta</li>
      </ul>
    </section>
  );
}
