/**
 * T-108: qué le contesta Aurela por DM a quien comenta una palabra clave en
 * sus Reels. Por ahora vive en código (cambiar un texto es un PR chico); un
 * editor en el back office queda para cuando haya que cambiarlos seguido.
 *
 * Trato de usted, como el resto de Aurela. El enlace va en el texto: en un DM
 * de Instagram se vuelve clicable y muestra la vista previa de la página.
 */

import type { RespuestaComentario } from "@/core/channels/instagram/comentarios";

const PAGINA = "https://soyaurela.com";

export const RESPUESTAS_COMENTARIOS: RespuestaComentario[] = [
  {
    palabras: ["ALMUERZO", "ALMUERZOS"],
    mensaje:
      "¡Hola! Soy Aurela 👋 La asistente que atiende el WhatsApp de su negocio mientras usted cocina: " +
      "le manda el menú al cliente, suma el total con domicilio y revisa cada comprobante antes de que usted entregue.\n\n" +
      `Mire cómo funciona y pruébelo con un pedido de ejemplo 👉 ${PAGINA}\n\n` +
      "Instalación gratis y 14 días de prueba 🍲",
    respuestaPublica: "¡Le escribí por DM! 📩",
  },
  {
    palabras: ["CITA", "CITAS"],
    mensaje:
      "¡Hola! Soy Aurela 💅 Atiendo el WhatsApp de su salón mientras usted trabaja: " +
      "respondo \"¿tiene cupo hoy?\", agendo la cita y le aviso cuando llega el comprobante.\n\n" +
      `Vea cómo funciona 👉 ${PAGINA}\n\n` +
      "14 días gratis, sin permanencia ✨",
    respuestaPublica: "¡Le escribí por DM! 📩",
  },
];
