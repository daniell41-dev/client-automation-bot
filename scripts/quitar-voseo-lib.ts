/**
 * T-78: lógica pura de `quitar-voseo-db.ts` — separada del script para poder
 * testearla sin Supabase (mismo criterio que `migrar-horarios-lib.ts`).
 *
 * Dos pasadas, de la más segura a la menos:
 *
 * 1. `TEXTOS_POR_DEFECTO`: el texto completo de un campo es EXACTAMENTE un
 *    default viejo (de una plantilla de rubro, un negocio de ejemplo o el
 *    motor) → se cambia por el default nuevo, escrito a mano. Cubre los
 *    textos tuteados ("¿Qué servicio te interesa?"), que la pasada 2 no toca.
 * 2. Un texto que la dueña escribió a su manera solo se toca si tiene voseo:
 *    ahí se cambian los verbos de `VOSEO_A_USTED` y, en ese mismo texto, los
 *    pronombres (tu → su, te → le). Si el texto solo tutea se deja como
 *    está: tutear puede ser una decisión del negocio (preset "Cercano"), el
 *    voseo nunca lo es en Cúcuta.
 *
 * Nunca toca nombres de productos, palabras clave ni opciones de entrega:
 * los dos primeros los usa el bot para reconocer lo que escribe el cliente,
 * y las opciones quedan copiadas en pedidos viejos (`modalidad`).
 */

/** Default viejo exacto → default nuevo. Generado comparando los configs de antes y después de T-78. */
export const TEXTOS_POR_DEFECTO: Record<string, string> = {
  "¡Hola! Gracias por escribirnos 💜 ¿Qué servicio te interesa?\n1. Limpieza facial\n2. Uñas\n3. Pestañas\n4. Depilación":
    "¡Hola! Gracias por escribirnos 💜 ¿Qué servicio le interesa?\n1. Limpieza facial\n2. Uñas\n3. Pestañas\n4. Depilación",
  "¡Perfecto! Para ayudarte mejor, ¿cuál es tu nombre? 😊":
    "¡Perfecto! Para ayudarle mejor, ¿cuál es su nombre? 😊",
  "Genial {{nombre}} 💜 ¿Qué día te gustaría agendar?":
    "Genial {{nombre}} 💜 ¿Qué día le gustaría agendar?",
  "¿Te confirmo tu cita de {{servicio}} para {{fecha}}, {{nombre}}? 💜":
    "¿Le confirmo su cita de {{servicio}} para {{fecha}}, {{nombre}}? 💜",
  "¡Listo {{nombre}}! ✨ Tu cita de {{servicio}} para {{fecha}} quedó agendada.\nTe esperamos 💜 {{agenda}}":
    "¡Listo {{nombre}}! ✨ Su cita de {{servicio}} para {{fecha}} quedó agendada.\nLa esperamos 💜 {{agenda}}",
  "Disculpa, no te entendí 😅. ¿Qué servicio te interesa?\n1. Limpieza facial\n2. Uñas\n3. Pestañas\n4. Depilación":
    "Disculpe, no le entendí 😅. ¿Qué servicio le interesa?\n1. Limpieza facial\n2. Uñas\n3. Pestañas\n4. Depilación",
  "Estamos en Calle 45 #12-30, Bogotá. ¡Te esperamos! 💜":
    "Estamos en Calle 45 #12-30, Bogotá. ¡La esperamos! 💜",
  "español colombiano informal":
    "español de Colombia, trato de usted",
  "español colombiano informal y juvenil":
    "español de Colombia, cercano y juvenil",
  "¡Hola! Gracias por escribirnos ✂️ ¿Qué servicio te interesa?":
    "¡Hola! Gracias por escribirnos ✂️ ¿Qué servicio le interesa?",
  "¡Perfecto! ¿Cuál es tu nombre? 😊":
    "¡Perfecto! ¿Cuál es su nombre? 😊",
  "Genial {{nombre}} ¿Qué día y hora te queda bien?":
    "Genial {{nombre}} ¿Qué día y hora le queda bien?",
  "¿Te confirmo tu cita de {{servicio}} para {{fecha}}, {{nombre}}?":
    "¿Le confirmo su cita de {{servicio}} para {{fecha}}, {{nombre}}?",
  "¡Listo {{nombre}}! ✨ Tu cita de {{servicio}} para {{fecha}} quedó agendada. Te esperamos.":
    "¡Listo {{nombre}}! ✨ Su cita de {{servicio}} para {{fecha}} quedó agendada. Lo esperamos.",
  "Disculpa, no te entendí 😅 ¿Qué servicio te interesa?":
    "Disculpe, no le entendí 😅 ¿Qué servicio le interesa?",
  "¡Hola! Gracias por escribirnos 🌿 ¿Qué servicio te interesa?":
    "¡Hola! Gracias por escribirnos 🌿 ¿Qué servicio le interesa?",
  "¡Hola! Bienvenido 🍽️ ¿Qué te gustaría pedir hoy?":
    "¡Hola! Bienvenido 🍽️ ¿Qué le gustaría pedir hoy?",
  "¿Para qué hora lo querés?":
    "¿Para qué hora lo quiere?",
  "¿Te confirmo el pedido, {{nombre}}?":
    "¿Le confirmo el pedido, {{nombre}}?",
  "¡Listo {{nombre}}! Tu pedido quedó registrado.":
    "¡Listo {{nombre}}! Su pedido quedó registrado.",
  "Disculpa, no te entendí 😅 ¿Qué te gustaría pedir?":
    "Disculpe, no le entendí 😅 ¿Qué le gustaría pedir?",
  "¿Te lo mandamos a domicilio o lo recogés en el local?":
    "¿Se lo enviamos a domicilio o lo recoge en el local?",
  "Hola {{nombre}}, vi que estabas interesada en {{servicio}}. ¿Quieres que te comparta horarios disponibles para esta semana?":
    "Hola {{nombre}}, vi que estaba interesada en {{servicio}}. ¿Quiere que le comparta horarios disponibles para esta semana?",
  "Tenemos algunos cupos disponibles esta semana para {{servicio}}. También puedes separar tu cita con un anticipo 💜":
    "Tenemos algunos cupos disponibles esta semana para {{servicio}}. También puede separar su cita con un anticipo 💜",
  "Último mensaje para no molestarte 😊 ¿Te gustaría que te avisemos cuando haya promoción de {{servicio}}?":
    "Último mensaje para no molestarla 😊 ¿Le gustaría que le avisemos cuando haya promoción de {{servicio}}?",
  "Reservá tu mesa para cenar tranquilo sin esperas. Capacidad para grupos de 2 a 10 personas.":
    "Reserve su mesa para cenar tranquilo sin esperas. Capacidad para grupos de 2 a 10 personas.",
  "Pedí nuestros platos a domicilio. Entrega en 40-60 minutos dentro del área de cobertura.":
    "Pida nuestros platos a domicilio. Entrega en 40-60 minutos dentro del área de cobertura.",
  "Organizamos tu evento privado o empresarial. Menú personalizado, decoración y servicio completo.":
    "Organizamos su evento privado o empresarial. Menú personalizado, decoración y servicio completo.",
  "¡Hola! Bienvenido a Sabores del Sur 🍽️ ¿En qué te podemos ayudar?\n1. Reserva de mesa\n2. Delivery\n3. Eventos y catering":
    "¡Hola! Bienvenido a Sabores del Sur 🍽️ ¿En qué le podemos ayudar?\n1. Reserva de mesa\n2. Delivery\n3. Eventos y catering",
  "¡Con gusto! Para continuar, ¿cuál es tu nombre? 😊":
    "¡Con gusto! Para continuar, ¿cuál es su nombre? 😊",
  "Perfecto {{nombre}} 🍽️ ¿Para qué día y hora te gustaría?":
    "Perfecto {{nombre}} 🍽️ ¿Para qué día y hora le gustaría?",
  "¿Te confirmo {{servicio}} para {{fecha}}, {{nombre}}? 🍽️":
    "¿Le confirmo {{servicio}} para {{fecha}}, {{nombre}}? 🍽️",
  "¡Listo {{nombre}}! ✅ Tu {{servicio}} para {{fecha}} quedó registrada.\n¡Te esperamos en Sabores del Sur! 🍽️ {{agenda}}":
    "¡Listo {{nombre}}! ✅ Su {{servicio}} para {{fecha}} quedó registrada.\n¡Lo esperamos en Sabores del Sur! 🍽️ {{agenda}}",
  "Disculpá, no te entendí 😅. ¿Te puedo ayudar con alguno de estos?\n1. Reserva de mesa\n2. Delivery\n3. Eventos y catering":
    "Disculpe, no le entendí 😅. ¿Le puedo ayudar con alguno de estos?\n1. Reserva de mesa\n2. Delivery\n3. Eventos y catering",
  "Hola {{nombre}}, vimos que estabas interesado en {{servicio}}. ¿Querés que te cuente la disponibilidad para esta semana?":
    "Hola {{nombre}}, vimos que estaba interesado en {{servicio}}. ¿Quiere que le cuente la disponibilidad para esta semana?",
  "¡Tenemos mesa disponible para {{servicio}} esta semana! Confirmá tu lugar antes de que se llene 🍽️":
    "¡Tenemos mesa disponible para {{servicio}} esta semana! Confirme su lugar antes de que se llene 🍽️",
  "Último aviso 😊 ¿Querés que te avisemos cuando haya promos especiales de {{servicio}}?":
    "Último aviso 😊 ¿Quiere que le avisemos cuando haya promos especiales de {{servicio}}?",
  "Describe qué incluye el servicio.":
    "Describa qué incluye el servicio.",
  "¡Hola! ¿Qué servicio te interesa?":
    "¡Hola! ¿Qué servicio le interesa?",
  "Para ayudarte mejor, ¿cuál es tu nombre?":
    "Para ayudarle mejor, ¿cuál es su nombre?",
  "{{nombre}}, ¿qué día te gustaría agendar?":
    "{{nombre}}, ¿qué día le gustaría agendar?",
  "¡Listo {{nombre}}! Tu cita de {{servicio}} para {{fecha}} quedó agendada. {{agenda}}":
    "¡Listo {{nombre}}! Su cita de {{servicio}} para {{fecha}} quedó agendada. {{agenda}}",
  "No te entendí 😅. ¿Qué servicio te interesa?":
    "No le entendí 😅. ¿Qué servicio le interesa?",
  "Hola {{nombre}}, ¿te comparto horarios de {{servicio}}?":
    "Hola {{nombre}}, ¿le comparto horarios de {{servicio}}?",
  "Último mensaje 😊 ¿Te aviso de promos de {{servicio}}?":
    "Último mensaje 😊 ¿Le aviso de promos de {{servicio}}?",
  "¡Hola {{nombre}}! Ya tenés agendado {{servicio}} para {{fecha}}. Si necesitás cambiar algo o tenés otra consulta, contame 🙂":
    "¡Hola {{nombre}}! Ya tiene agendado {{servicio}} para {{fecha}}. Si necesita cambiar algo o tiene otra consulta, cuénteme 🙂",
  "¿Cuántas unidades de {{servicio}} querés, {{nombre}}?":
    "¿Cuántas unidades de {{servicio}} quiere, {{nombre}}?",
  "¿Confirmás tu pedido?":
    "¿Confirma su pedido?",
  "¡Gracias {{nombre}}! Tu pedido quedó en revisión, en un momento te confirmamos 🙏":
    "¡Gracias {{nombre}}! Su pedido quedó en revisión, en un momento le confirmamos 🙏",
  "¡Gracias {{nombre}}! Tu pedido quedó confirmado. En breve te contactamos para coordinar la entrega.":
    "¡Gracias {{nombre}}! Su pedido quedó confirmado. En breve lo contactamos para coordinar la entrega.",
  "Uy {{nombre}}, no pudimos confirmar tu pedido esta vez. Cualquier cosa contame y vemos qué opciones hay 🙏":
    "Uy {{nombre}}, no pudimos confirmar su pedido esta vez. Cualquier cosa cuénteme y vemos qué opciones hay 🙏",
  "¡Hola {{nombre}}! Ya tenés un pedido confirmado con nosotros. Si querés hacer un pedido nuevo o tenés otra consulta, contame 🙂":
    "¡Hola {{nombre}}! Ya tiene un pedido confirmado con nosotros. Si quiere hacer un pedido nuevo o tiene otra consulta, cuénteme 🙂",
  "¿Querés agregar algo más a tu pedido?":
    "¿Quiere agregar algo más a su pedido?",
  "¿A qué dirección te lo mandamos? Incluí el barrio y alguna referencia 🏠":
    "¿A qué dirección se lo enviamos? Incluya el barrio y alguna referencia 🏠",
  "Para confirmar tu pedido, pagá a:\n{{datosPago}}\n\nY mandanos la foto del comprobante 📸":
    "Para confirmar su pedido, pague a:\n{{datosPago}}\n\nY envíenos la foto del comprobante 📸",
  "español informal":
    "español de Colombia, trato de usted",
  "Para confirmar tu pedido, hacé el pago y mandanos la foto del comprobante 📸":
    "Para confirmar su pedido, haga el pago y envíenos la foto del comprobante 📸",
};

/**
 * Formas de voseo que aparecen en textos de negocios → su forma de usted.
 * No incluye formas ambiguas: "pedí" también es "yo pedí", y cambiarla
 * rompería frases como "ya pedí el domicilio".
 */
export const VOSEO_A_USTED: Record<string, string> = {
  vos: "usted",
  sos: "es",
  tenés: "tiene",
  querés: "quiere",
  podés: "puede",
  necesitás: "necesita",
  confirmás: "confirma",
  buscás: "busca",
  escribís: "escribe",
  respondés: "responde",
  recogés: "recoge",
  preferís: "prefiere",
  sabés: "sabe",
  venís: "viene",
  tocá: "toque",
  respondé: "responda",
  revisá: "revise",
  escribí: "escriba",
  mandá: "envíe",
  elegí: "elija",
  creá: "cree",
  usá: "use",
  confirmá: "confirme",
  reservá: "reserve",
  agregá: "agregue",
  pagá: "pague",
  hacé: "haga",
  probá: "pruebe",
  mirá: "mire",
  disculpá: "disculpe",
  contactá: "contacte",
  avisá: "avise",
  decí: "diga",
  vení: "venga",
  pedilo: "pídalo",
  pedila: "pídala",
  contame: "cuénteme",
  decime: "dígame",
  escribime: "escríbame",
  avisame: "avíseme",
  mandame: "envíeme",
  fijate: "fíjese",
  acordate: "recuerde",
  mandanos: "envíenos",
  escribinos: "escríbanos",
  decinos: "díganos",
  contanos: "cuéntenos",
  avisanos: "avísenos",
  acá: "aquí",
  celu: "celular",
};

/** Pronombres de tú → usted. Solo se aplican a un texto que ya tenía voseo (ver arriba). */
const PRONOMBRES: [RegExp, string][] = [
  // "te lo mandamos" → "se lo mandamos", no "le lo": va antes que "te" solo.
  [/(?<![\p{L}])te (lo|la|los|las)(?![\p{L}])/giu, "se $1"],
  [/(?<![\p{L}])tus(?![\p{L}])/giu, "sus"],
  [/(?<![\p{L}])tu(?![\p{L}])/giu, "su"],
  [/(?<![\p{L}])te(?![\p{L}])/giu, "le"],
  [/(?<![\p{L}])contigo(?![\p{L}])/giu, "con usted"],
  [/(?<![\p{L}])ti(?![\p{L}])/giu, "usted"],
];

const PATRON_VOSEO = new RegExp(
  `(?<![\\p{L}])(${Object.keys(VOSEO_A_USTED).join("|")})(?![\\p{L}])`,
  "giu",
);

/** Respeta la mayúscula inicial del original ("Tenés" → "Tiene"). */
function conMismaMayuscula(original: string, reemplazo: string): string {
  return original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()
    ? reemplazo[0].toUpperCase() + reemplazo.slice(1)
    : reemplazo;
}

export function tieneVoseo(texto: string): boolean {
  PATRON_VOSEO.lastIndex = 0;
  return PATRON_VOSEO.test(texto);
}

/** Pasa un texto a usted según las dos reglas de arriba; devuelve el mismo texto si no hay nada que cambiar. */
export function quitarVoseoTexto(texto: string): string {
  const porDefecto = TEXTOS_POR_DEFECTO[texto];
  if (porDefecto !== undefined) return porDefecto;
  if (!tieneVoseo(texto)) return texto;
  let nuevo = texto.replace(PATRON_VOSEO, (palabra) =>
    conMismaMayuscula(palabra, VOSEO_A_USTED[palabra.toLowerCase()]),
  );
  for (const [patron, reemplazo] of PRONOMBRES) {
    nuevo = nuevo.replace(patron, (palabra, ...grupos) =>
      conMismaMayuscula(palabra, reemplazo.replace("$1", typeof grupos[0] === "string" ? grupos[0] : "")),
    );
  }
  return nuevo;
}

export interface CambioTexto {
  /** Ruta legible del campo, p. ej. `messages.welcome` o `followUps[1].message`. */
  campo: string;
  antes: string;
  despues: string;
}

type Json = Record<string, unknown>;

function esObjeto(valor: unknown): valor is Json {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/**
 * Devuelve una copia del config (o template de rubro) con los textos que lee
 * el cliente pasados a usted, y la lista de cambios para mostrar en el
 * dry-run. No valida: eso lo hace el script con `businessConfigSchema`
 * antes de escribir (regla 5 de AGENTS.md).
 */
export function quitarVoseoConfig(original: Json): { config: Json; cambios: CambioTexto[] } {
  const config = structuredClone(original);
  const cambios: CambioTexto[] = [];

  const cambiar = (dueño: Json, clave: string, campo: string) => {
    const antes = dueño[clave];
    if (typeof antes !== "string") return;
    const despues = quitarVoseoTexto(antes);
    if (despues !== antes) {
      dueño[clave] = despues;
      cambios.push({ campo, antes, despues });
    }
  };
  const cambiarLista = (dueño: Json, clave: string, campo: string) => {
    const lista = dueño[clave];
    if (!Array.isArray(lista)) return;
    lista.forEach((item, i) => {
      const antes = item;
      if (typeof antes !== "string") return;
      const despues = quitarVoseoTexto(antes);
      if (despues !== antes) {
        lista[i] = despues;
        cambios.push({ campo: `${campo}[${i}]`, antes, despues });
      }
    });
  };

  if (esObjeto(config.messages)) {
    for (const clave of Object.keys(config.messages)) cambiar(config.messages, clave, `messages.${clave}`);
  }
  if (Array.isArray(config.followUps)) {
    config.followUps.forEach((f, i) => esObjeto(f) && cambiar(f, "message", `followUps[${i}].message`));
  }
  if (Array.isArray(config.services)) {
    config.services.forEach((s, i) => esObjeto(s) && cambiar(s, "description", `services[${i}].description`));
  }
  if (esObjeto(config.pedidos)) cambiar(config.pedidos, "pregunta", "pedidos.pregunta");
  if (esObjeto(config.ai)) {
    cambiar(config.ai, "knowledge", "ai.knowledge");
    cambiarLista(config.ai, "botonesMenu", "ai.botonesMenu");
    if (Array.isArray(config.ai.reglas)) {
      config.ai.reglas.forEach((r, i) => esObjeto(r) && cambiar(r, "respuesta", `ai.reglas[${i}].respuesta`));
    }
  }
  if (esObjeto(config.personas)) {
    for (const [canal, persona] of Object.entries(config.personas)) {
      if (esObjeto(persona)) cambiar(persona, "language", `personas.${canal}.language`);
    }
  }
  return { config, cambios };
}
