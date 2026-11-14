/**
 * T-80: para qué negocios sirve, con los colores de rubro del portal.
 * T-87: en vez de tres tarjetas iguales, pestañas que muestran cómo le
 * contesta Nexo a un cliente de cada tipo de negocio.
 *
 * Las conversaciones salen del motor real (plantillas de rubro, modo guiado),
 * no de un guion ideal. Donde el bot hace más preguntas en el medio, se marca
 * con "· · ·" para no fingir que es más corto de lo que es. Si cambian los
 * textos del bot, cambian aquí.
 *
 * Los paneles se arman aquí (servidor); `NegociosPestanas` solo cambia cuál
 * se ve.
 */

import type { ReactNode } from "react";
import { Scissors, ShoppingBag, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { Burbuja, FondoChat, RespuestasRapidas, TurnosOmitidos } from "@/components/landing/chat";
import { NegociosPestanas, type Pestana } from "@/components/landing/negocios-pestanas";
import { Seccion } from "@/components/landing/seccion";

interface Rubro {
  id: string;
  etiqueta: string;
  titulo: string;
  texto: string;
  Icono: LucideIcon;
  /** Tile del icono y borde de la pestaña activa: mismos tokens que `rubro-visual.tsx`. */
  tile: string;
  acento: string;
  conversacion: ReactNode;
}

const RUBROS: Rubro[] = [
  {
    id: "restaurantes",
    etiqueta: "Restaurantes",
    titulo: "Restaurantes y comidas",
    texto: "Pedidos a domicilio o para recoger, con código de retiro.",
    Icono: UtensilsCrossed,
    tile: "bg-rubro-gastro-bg text-rubro-gastro-ink",
    acento: "border-rubro-gastro-ink",
    conversacion: (
      <>
        <Burbuja de="cliente">Buenas, 2 hamburguesas</Burbuja>
        <Burbuja de="negocio">
          {"Hamburguesa sencilla: Carne, queso y papas. — $ 18.000.\n\n¡Con gusto! ¿A nombre de quién va el pedido?"}
        </Burbuja>
        <Burbuja de="cliente">Laura</Burbuja>
        <TurnosOmitidos texto="pregunta la cantidad, la entrega y la dirección" />
        <Burbuja de="negocio">
          {"2x Hamburguesa sencilla — $ 36.000\nDomicilio — $ 5.000\nTotal: $ 41.000\n\nEntrega: Domicilio\nDirección: Av. 4 #12-30, La Riviera\n\n¿Confirma su pedido?"}
        </Burbuja>
        <RespuestasRapidas opciones={["Sí, confirmar", "Agregar más"]} />
      </>
    ),
  },
  {
    id: "barberias",
    etiqueta: "Barberías y estética",
    titulo: "Barberías, salones y estética",
    texto: "Citas agendadas mientras usted atiende.",
    Icono: Scissors,
    tile: "bg-rubro-servicios-bg text-rubro-servicios-ink",
    acento: "border-rubro-servicios-ink",
    conversacion: (
      <>
        <Burbuja de="cliente">¿Tiene turno hoy a las 5?</Burbuja>
        <Burbuja de="negocio">¡Hola! Gracias por escribirnos ✂️ ¿Qué servicio le interesa?</Burbuja>
        <RespuestasRapidas opciones={["Corte dama", "Corte caballero", "Tinte"]} />
        <Burbuja de="cliente">Corte caballero</Burbuja>
        <TurnosOmitidos texto="pide el nombre y confirma" />
        <Burbuja de="negocio">¡Listo Andrés! ✨ Su cita de Corte caballero para hoy a las 5 quedó agendada. Lo esperamos.</Burbuja>
      </>
    ),
  },
  {
    id: "tiendas",
    etiqueta: "Tiendas",
    titulo: "Tiendas",
    texto: "Pedidos con inventario: no vende lo que ya no tiene.",
    Icono: ShoppingBag,
    tile: "bg-rubro-comercio-bg text-rubro-comercio-ink",
    acento: "border-rubro-comercio-ink",
    conversacion: (
      <>
        <Burbuja de="cliente">¿Tienen cargador tipo C?</Burbuja>
        <Burbuja de="negocio">
          {"Cargador tipo C: Cargador rápido USB tipo C. — $ 25.000.\n\n¡Con gusto! ¿A nombre de quién va el pedido?"}
        </Burbuja>
        <Burbuja de="cliente">Laura</Burbuja>
        <Burbuja de="negocio">¿Cuántas unidades de Cargador tipo C quiere, Laura?</Burbuja>
      </>
    ),
  },
];

export function Negocios() {
  const pestanas: Pestana[] = RUBROS.map(({ id, etiqueta, titulo, texto, Icono, tile, acento, conversacion }) => ({
    id,
    etiqueta,
    acento,
    panel: (
      <div className="grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,360px)] md:gap-12">
        <div>
          <span className={`inline-flex h-12 w-12 items-center justify-center rounded-[14px] ${tile}`}>
            <Icono className="h-6 w-6" aria-hidden />
          </span>
          <h3 className="mt-4 text-[22px] font-extrabold text-ink sm:text-[26px]">{titulo}</h3>
          <p className="mt-2 max-w-md text-[16px] leading-relaxed text-ink-mid">{texto}</p>
          <p className="mt-4 text-[13px] text-ink-mid">Conversación de ejemplo con las respuestas que da Nexo hoy.</p>
        </div>
        <FondoChat className="w-full">{conversacion}</FondoChat>
      </div>
    ),
  }));

  return (
    <Seccion id="negocios" titulo="Para qué negocios">
      <NegociosPestanas pestanas={pestanas} />
    </Seccion>
  );
}
