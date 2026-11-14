/**
 * T-83: el diferencial de Nexo mostrado en vez de contado. Un comprobante de
 * ejemplo y las cuatro preguntas que Nexo le hace a cada uno, cada una unida
 * a la parte del comprobante que revisa.
 *
 * Una sola rejilla CSS para los dos tamaños, así cada anotación queda siempre
 * a la altura de su dato:
 * - escritorio: tres columnas (dato · línea · anotación), una fila por dato;
 * - celular: una columna; la anotación va encima de su dato, dentro de la
 *   tarjeta, con una línea corta que baja hasta él.
 * El fondo blanco de la tarjeta es un elemento aparte que ocupa todas las
 * filas de la primera columna.
 *
 * Las anotaciones entran al aparecer en pantalla (`animation-timeline: view()`
 * en globals.css, dentro de @supports). Sin soporte, o con "reducir
 * movimiento", se ven fijas. Componente de servidor: cero JavaScript.
 *
 * El texto no promete que Nexo detecte todo: avisa, y la que decide es la dueña.
 *
 * T-92: una línea de escaneo baja por el comprobante a medida que la dueña
 * baja por la página, y cada dato recibe su marca cuando la línea pasa: tres
 * en verde y la fecha en ámbar (es de hace 12 días). Así la revisión se ve
 * pasar, no solo se cuenta. Todas las piezas leen el mismo avance (la línea
 * de tiempo `--comprobante`, que da la tarjeta) para que la marca salga justo
 * cuando la línea llega a su dato. Sin soporte o con "reducir movimiento" no
 * hay línea y las marcas se ven puestas: el resultado de la revisión.
 */

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { BotonWhatsApp } from "@/components/landing/boton-whatsapp";
import { Seccion } from "@/components/landing/seccion";

/** Hace 12 días, a la hora del negocio. La página se genera al compilar: con el tiempo queda aún más vieja, que es justo el punto. */
function fechaDeHace12Dias(): string {
  const fecha = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" }).format(fecha);
}

/**
 * Cada dato con su pregunta. Las clases de fila van escritas completas (no
 * armadas con plantillas) para que Tailwind las encuentre al compilar.
 */
const FILAS = [
  {
    etiqueta: "Monto",
    valor: () => "$40.000",
    grande: true,
    anotacion: "Monto: ¿es el total del pedido?",
    filaDato: "row-start-3 lg:row-start-2",
    filaAnotacion: "row-start-2 lg:row-start-2",
  },
  {
    etiqueta: "Destino",
    valor: () => "300 000 0000",
    anotacion: "Cuenta: ¿llegó a la de su negocio?",
    filaDato: "row-start-5 lg:row-start-3",
    filaAnotacion: "row-start-4 lg:row-start-3",
  },
  {
    etiqueta: "Referencia",
    valor: () => "M4471902",
    anotacion: "Referencia: ¿ya se la habían mandado?",
    filaDato: "row-start-7 lg:row-start-4",
    filaAnotacion: "row-start-6 lg:row-start-4",
  },
  {
    etiqueta: "Fecha",
    valor: () => `${fechaDeHace12Dias()} · 7:15 p. m.`,
    anotacion: "Fecha: ¿es de hoy?",
    filaDato: "row-start-9 lg:row-start-5",
    // La única que no pasa: un comprobante de hace 12 días no es el de hoy.
    alerta: "Hace 12 días",
    filaAnotacion: "row-start-8 lg:row-start-5",
  },
];

export function Comprobante() {
  return (
    <Seccion id="comprobante" titulo="Le avisamos antes de que despache un pedido mal pagado." oscura>
      <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-white/75 sm:text-[17px]">
        Nexo lee cada comprobante que le mandan y le avisa si algo no cuadra. La decisión siempre es suya.
      </p>

      <div className="escaneo-alcance mt-10 grid grid-cols-1 grid-rows-[repeat(10,auto)] lg:grid-cols-[340px_64px_minmax(0,1fr)] lg:grid-rows-[repeat(6,auto)]">
        {/* Fondo de la tarjeta, con el único borde con brillo azul de la página. */}
        <div
          aria-hidden
          data-brillo
          className="escaneo-tarjeta col-start-1 row-[1/11] rounded-2xl border border-primary-light/70 bg-surface shadow-[0_0_0_1px_rgba(76,141,255,0.35),0_0_44px_-8px_rgba(42,111,219,0.75)] lg:row-[1/7]"
        />

        {/* La línea de escaneo: una capa del alto de la tarjeta que baja entera
            (translateY 0 → 100% de su propio alto); el recorte la deja ver
            solo dentro de la tarjeta. */}
        <div aria-hidden className="pointer-events-none relative z-10 col-start-1 row-[1/11] overflow-hidden rounded-2xl lg:row-[1/7]">
          <div className="escaneo-linea absolute inset-0">
            <span className="block h-[2px] bg-primary shadow-[0_0_12px_2px_rgba(42,111,219,0.55)]" />
            <span className="block h-10 bg-gradient-to-b from-primary/15 to-transparent" />
          </div>
        </div>

        {/* Encabezado tipo captura de transferencia: sin logos ni nombres de bancos. */}
        <div className="col-start-1 row-start-1 flex items-center justify-between gap-3 border-b border-line px-5 pb-4 pt-5">
          <span className="flex items-center gap-2 text-[14px] font-bold text-ink">
            <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
            Transferencia exitosa
          </span>
          <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink-mid">Ejemplo</span>
        </div>

        {FILAS.map((f, i) => (
          <div key={f.etiqueta} className="contents">
            <div className={`col-start-1 ${f.filaDato} px-5 pb-4 lg:flex lg:min-h-[76px] lg:flex-col lg:justify-center lg:py-3`}>
              <p className="text-[12px] font-semibold text-ink-mid">{f.etiqueta}</p>
              <p className={`flex flex-wrap items-center gap-x-2 font-display font-bold text-ink ${f.grande ? "text-[30px] leading-tight" : "text-[17px]"}`}>
                {f.valor()}
                {f.alerta ? (
                  <span className={`escaneo-marca escaneo-marca-${i + 1} inline-flex items-center gap-1 rounded-full bg-warn-bg px-2 py-0.5 font-sans text-[12px] font-bold text-warn-ink`}>
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                    {f.alerta}
                  </span>
                ) : (
                  <CheckCircle2 className={`escaneo-marca escaneo-marca-${i + 1} h-5 w-5 shrink-0 text-success`} aria-label="Revisado" />
                )}
              </p>
            </div>

            {/* Línea horizontal en escritorio, con un punto sobre el dato. */}
            <span aria-hidden className={`anotacion-linea anotacion-${i + 1} col-start-2 hidden items-center lg:flex ${f.filaAnotacion}`}>
              <span className="-ml-1 h-2 w-2 rounded-full bg-primary-light" />
              <span className="h-px flex-1 bg-primary-light/70" />
            </span>

            <div className={`anotacion anotacion-${i + 1} col-start-1 px-5 pt-1 lg:col-start-3 lg:flex lg:items-center lg:px-0 lg:pt-0 ${f.filaAnotacion}`}>
              <p className="relative inline-flex rounded-xl bg-primary-tint px-3 py-2 text-[14px] font-semibold leading-snug text-ink lg:text-[15px]">
                {f.anotacion}
              </p>
              {/* Línea corta hacia el dato, solo en celular (en escritorio va la horizontal). */}
              <span aria-hidden className="ml-4 block h-3 w-px bg-primary lg:hidden" />
            </div>
          </div>
        ))}

        <p className="col-start-1 row-start-10 border-t border-line px-5 py-3 text-[12px] text-ink-mid lg:row-start-6">
          Comprobante de ejemplo: los datos no son reales.
        </p>
      </div>

      <BotonWhatsApp origen="comprobante" className="mt-10 w-full sm:w-auto" />
    </Seccion>
  );
}
