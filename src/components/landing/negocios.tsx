/**
 * T-80: para qué negocios sirve, con los colores de rubro del portal.
 * T-87: en vez de tres tarjetas iguales, pestañas que muestran cómo le
 * contesta Aurela a un cliente de cada tipo de negocio.
 *
 * Las conversaciones salen del motor real (plantillas de rubro, modo guiado),
 * no de un guion ideal. Sin saltos marcados con "· · ·" (a pedido del dueño):
 * cada chat muestra todas las respuestas en orden, y el del restaurante corta
 * en el total en vez de saltarse pasos para llegar al resumen final. Si
 * cambian los textos del bot, cambian aquí (negocios.test.ts avisa).
 *
 * Los paneles se arman aquí (servidor); `NegociosPestanas` solo cambia cuál
 * se ve.
 */

import type { ReactNode } from "react";
import { Scissors, ShoppingBag, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { Burbuja, FondoChat, RespuestasRapidas } from "@/components/landing/chat";
import { NegociosPestanas, type Pestana } from "@/components/landing/negocios-pestanas";
import { Seccion } from "@/components/landing/seccion";
import { textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (landing.negocios). */
const tt = textos.landing.negocios;

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
    etiqueta: tt.restaurantes,
    titulo: tt.restaurantesYComidas,
    texto: tt.pedidosADomicilioO,
    Icono: UtensilsCrossed,
    tile: "bg-rubro-gastro-bg text-rubro-gastro-ink",
    acento: "border-rubro-gastro-ink",
    conversacion: (
      <>
        <Burbuja de="cliente">{tt.buenas2Hamburguesas}</Burbuja>
        <Burbuja de="negocio">
          {tt.hamburguesaSencillaCarneQueso}
        </Burbuja>
        <Burbuja de="cliente">{tt.laura}</Burbuja>
        <Burbuja de="negocio">{tt.cuantasUnidadesDeHamburguesa}</Burbuja>
        <Burbuja de="cliente">2</Burbuja>
        <Burbuja de="negocio">
          {tt.t2xHamburguesaSencilla36}
        </Burbuja>
        <RespuestasRapidas opciones={tt.respuestasRapidas.restaurante} />
      </>
    ),
  },
  {
    id: "barberias",
    etiqueta: tt.barberiasYEstetica,
    titulo: tt.barberiasSalonesYEstetica,
    texto: tt.citasAgendadasMientrasUsted,
    Icono: Scissors,
    tile: "bg-rubro-servicios-bg text-rubro-servicios-ink",
    acento: "border-rubro-servicios-ink",
    conversacion: (
      <>
        <Burbuja de="cliente">{tt.tieneTurnoHoyA}</Burbuja>
        <Burbuja de="negocio">{tt.holaGraciasPorEscribirnos}</Burbuja>
        <RespuestasRapidas opciones={tt.respuestasRapidas.barberiaServicios} />
        <Burbuja de="cliente">{tt.corteCaballero}</Burbuja>
        <Burbuja de="negocio">
          {tt.corteCaballeroCorteCon}
        </Burbuja>
        <Burbuja de="cliente">{tt.andres}</Burbuja>
        <Burbuja de="negocio">{tt.leConfirmoSuCita}</Burbuja>
        <RespuestasRapidas opciones={tt.respuestasRapidas.barberiaConfirmar} />
        <Burbuja de="cliente">{tt.siConfirmar}</Burbuja>
        <Burbuja de="negocio">{tt.listoAndresSuCita}</Burbuja>
      </>
    ),
  },
  {
    id: "tiendas",
    etiqueta: tt.tiendas,
    titulo: tt.tiendas,
    texto: tt.pedidosConInventarioNo,
    Icono: ShoppingBag,
    tile: "bg-rubro-comercio-bg text-rubro-comercio-ink",
    acento: "border-rubro-comercio-ink",
    conversacion: (
      <>
        <Burbuja de="cliente">{tt.tienenCargadorTipoC}</Burbuja>
        <Burbuja de="negocio">
          {tt.cargadorTipoCCargador}
        </Burbuja>
        <Burbuja de="cliente">{tt.laura}</Burbuja>
        <Burbuja de="negocio">{tt.cuantasUnidadesDeCargador}</Burbuja>
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
          {/* Sin nota de "conversación de ejemplo": el chat se lee como ilustración
              y los textos siguen saliendo del motor real (ver arriba). */}
          <p className="mt-2 max-w-md text-[16px] leading-relaxed text-ink-mid">{texto}</p>
        </div>
        <FondoChat className="w-full">{conversacion}</FondoChat>
      </div>
    ),
  }));

  return (
    <Seccion id="negocios" titulo={tt.paraQueNegocios}>
      <NegociosPestanas pestanas={pestanas} />
    </Seccion>
  );
}
