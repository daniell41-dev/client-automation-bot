/**
 * T-99: límite de mensajes por número (negocio + contacto).
 *
 * Cada mensaje de un cliente puede costar una o varias llamadas a la IA
 * (transcribir un audio, leer una foto, el turno del agente). Un número que
 * manda cientos de mensajes —un bot, alguien probando inyecciones en bucle o
 * simple spam— le subiría la factura de IA al negocio y podría agotar la
 * cuota de WhatsApp. Un cliente real, aun escribiendo en ráfagas ("hola" /
 * "una hamburguesa" / "y una gaseosa"), no se acerca a estos topes.
 *
 * Ventana deslizante en memoria, no en la base:
 * - corre en un solo proceso (un contenedor en el VPS), así que la memoria
 *   alcanza; si algún día hay varias réplicas, cada una limita por su lado
 *   (el tope efectivo se multiplica, pero sigue habiendo tope);
 * - un reinicio del contenedor borra los contadores: aceptable, un despliegue
 *   no es algo que un atacante controle;
 * - no suma una consulta a Supabase por cada mensaje que entra.
 *
 * Al pasarse se le avisa UNA vez, con un mensaje amable, y después silencio
 * hasta que la ventana se libere: contestar cada mensaje del bucle también
 * costaría (y le confirmaría al atacante que sigue llegando).
 *
 * Sin I/O ni `Date.now()` adentro: el reloj entra por parámetro.
 */

export interface LimitesMensajes {
  /** Máximo de mensajes en `ventanaCortaMs` (frena las ráfagas). */
  porMinuto: number;
  /** Máximo de mensajes en `ventanaLargaMs` (frena el goteo sostenido). */
  porHora: number;
}

export const LIMITES_POR_DEFECTO: LimitesMensajes = { porMinuto: 15, porHora: 120 };

const MINUTO_MS = 60_000;
const HORA_MS = 60 * MINUTO_MS;

/** "ok": se atiende. "avisar": primer mensaje fuera del tope. "silencio": ya se le avisó. */
export type DecisionLimite = "ok" | "avisar" | "silencio";

export const MENSAJE_LIMITE =
  "Recibimos muchos mensajes seguidos desde su número 🙏 Espere unos minutos y me vuelve a escribir, con gusto le ayudo.";

interface Estado {
  /** Momentos (ms) de los mensajes atendidos dentro de la última hora. */
  marcas: number[];
  /** Ya se le mandó MENSAJE_LIMITE en esta racha. */
  avisado: boolean;
}

export class LimitadorMensajes {
  private readonly estados = new Map<string, Estado>();

  constructor(private readonly limites: LimitesMensajes = LIMITES_POR_DEFECTO) {}

  registrar(negocio: string, contacto: string, ahora: Date): DecisionLimite {
    const clave = `${negocio}:${contacto}`;
    const t = ahora.getTime();
    const estado = this.estados.get(clave) ?? { marcas: [], avisado: false };
    estado.marcas = estado.marcas.filter((m) => t - m < HORA_MS);

    const enElMinuto = estado.marcas.filter((m) => t - m < MINUTO_MS).length;
    const excedido = enElMinuto >= this.limites.porMinuto || estado.marcas.length >= this.limites.porHora;

    if (!excedido) {
      // Solo cuentan los mensajes atendidos: si los bloqueados contaran, un
      // bucle que no para nunca dejaría liberar la ventana.
      estado.marcas.push(t);
      estado.avisado = false;
      this.estados.set(clave, estado);
      return "ok";
    }

    this.estados.set(clave, estado);
    if (estado.avisado) return "silencio";
    estado.avisado = true;
    return "avisar";
  }

  /**
   * Borra los números sin actividad en la última hora. Sin esto el mapa
   * crece con cada contacto que escribió alguna vez; se llama de vez en
   * cuando desde el adaptador, no en cada mensaje.
   */
  limpiar(ahora: Date): void {
    const t = ahora.getTime();
    for (const [clave, estado] of this.estados) {
      if (estado.marcas.every((m) => t - m >= HORA_MS)) this.estados.delete(clave);
    }
  }

  get tamaño(): number {
    return this.estados.size;
  }
}
