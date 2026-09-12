/**
 * PLANTILLA para un negocio nuevo.
 *
 * Cómo usarla:
 *   1. Copia esta carpeta:  cp -r src/businesses/_template src/businesses/<slug>
 *   2. Ajusta los valores de abajo (servicios, precios, mensajes, seguimientos).
 *   3. Registra el negocio en `src/businesses/registry.ts`.
 *   4. Pruébalo:  pnpm sim "Hola" --business <slug>
 *
 * Reglas:
 *   - Esto es SOLO datos. No agregues lógica aquí.
 *   - No modifiques nada en `core/` para personalizar un negocio.
 *
 * Variables disponibles en las plantillas de mensajes:
 *   {{nombre}} {{servicio}} {{fecha}} {{negocio}} {{agenda}}
 *   En `serviceInfo` además: {{descripcion}} {{precio}} {{duracion}}
 */

import type { BusinessConfig } from "@/core/types";

export const plantilla: BusinessConfig = {
  slug: "mi-negocio", // identificador en kebab-case
  name: "Mi Negocio",
  // rubro: "restaurante", // opcional: se lo pasa a la IA en modo agente
  currency: "COP",
  locale: "es-CO",

  services: [
    {
      id: "servicio-1",
      name: "Servicio 1",
      description: "Describe qué incluye el servicio.",
      price: 100000,
      durationMinutes: 60,
      keywords: ["palabra1", "palabra2"], // para detectarlo en texto libre
      categoria: "General", // categoría visible en el catálogo del portal
      disponible: true, // en false, el bot no lo ofrece (toggle del portal)
      reservable: true, // aparece en "Servicios reservables" (citas)
    },
    // Agrega más servicios aquí…
  ],

  messages: {
    welcome: "¡Hola! ¿Qué servicio te interesa?",
    askName: "Para ayudarte mejor, ¿cuál es tu nombre?",
    askDate: "{{nombre}}, ¿qué día te gustaría agendar?",
    askConfirm: "¿Te confirmo tu cita de {{servicio}} para {{fecha}}, {{nombre}}?",
    serviceInfo:
      "{{servicio}}: {{descripcion}}\nDuración: {{duracion}}.\nPrecio: {{precio}}.",
    captured:
      "¡Listo {{nombre}}! Tu cita de {{servicio}} para {{fecha}} quedó agendada. {{agenda}}",
    fallback: "No te entendí 😅. ¿Qué servicio te interesa?",
  },

  followUps: [
    { threshold: "2h", afterMinutes: 120, message: "Hola {{nombre}}, ¿te comparto horarios de {{servicio}}?" },
    { threshold: "1d", afterMinutes: 1440, message: "Tenemos cupos para {{servicio}} esta semana." },
    { threshold: "3d", afterMinutes: 4320, message: "Último mensaje 😊 ¿Te aviso de promos de {{servicio}}?" },
  ],

  // bookingUrl: "https://calendly.com/tu-negocio", // opcional
  // direccion: "Calle 1 #2-34, Ciudad", // visible en Configuración del portal
  // botActivo: true, // en false el bot queda en pausa (toggle de la topbar)

  // Horarios de atención (sección "Citas y reservas" del portal) — T-20:
  // `dow` 0=domingo … 6=sábado (igual que Date.getDay()). Sin este campo, el
  // bot no valida citas contra ningún horario (se comporta como hoy).
  // horarios: [
  //   { dow: 0, abierto: false, tramos: [] },
  //   { dow: 1, abierto: true, tramos: [{ desde: "09:00", hasta: "18:00" }] },
  //   { dow: 2, abierto: true, tramos: [{ desde: "09:00", hasta: "18:00" }] },
  //   { dow: 3, abierto: true, tramos: [{ desde: "09:00", hasta: "18:00" }] },
  //   { dow: 4, abierto: true, tramos: [{ desde: "09:00", hasta: "18:00" }] },
  //   { dow: 5, abierto: true, tramos: [{ desde: "09:00", hasta: "18:00" }] },
  //   { dow: 6, abierto: false, tramos: [] },
  // ],

  // Cerebro del bot (sección "Respuestas y flujos" del portal).
  // Las reglas rápidas responden EXACTO por palabra clave, antes que la IA.
  // modo "agente" (default, no hace falta escribirlo): la IA decide qué
  // hacer en cada turno con criterio de vendedor — ver docs/13-modo-agente.md.
  // modo "guiado": el funnel paso a paso de siempre, la IA solo reformula.
  // ai: {
  //   enabled: true,
  //   modo: "agente", // o "guiado" — default "agente" si se omite
  //   knowledge: "Describe el negocio: qué vende, cómo cobra, si hace envíos…",
  //   reglas: [
  //     { keywords: ["horario", "abren"], respuesta: "Atendemos de 9 a 20 h." },
  //   ],
  //   botonesMenu: ["Ver servicios", "Agendar"],
  //   derivarHumano: true,
  // },

  // Modalidad de pedido (p. ej. restaurantes): agrega un paso extra entre el
  // nombre y la fecha para preguntar cómo se entrega. Deja `{{entrega}}`
  // disponible en `askConfirm`/`captured` si querés mencionarla ahí.
  // pedidos: {
  //   enabled: true,
  //   pregunta: "¿Vas a retirar tu pedido o prefieres comer en el local?",
  //   opciones: ["Retirar en el local", "Comer en el local"],
  // },

  // WhatsApp personal del dueño/a: si lo configurás, el bot le avisa por
  // WhatsApp (mismo número de WhatsApp Business) cuando se confirma una
  // cita o pedido. Formato E.164 sin "+".
  // notifyPhoneNumber: "573001234567",

  // Planilla de Google Sheets propia del negocio (modelo multi-tenant).
  // 1. Creá una planilla nueva en Google Sheets.
  // 2. Compartila (Editor) con el GOOGLE_SERVICE_ACCOUNT_EMAIL del .env.local.
  // 3. Pegá el ID que aparece en la URL: /spreadsheets/d/<ID>/edit
  // storage: {
  //   spreadsheetId: "", // ← pegá el ID acá
  // },

  // Personalización por canal (opcional). Sin esto las respuestas usan las
  // plantillas directamente, sin pasar por IA.
  // personas: {
  //   whatsapp: {
  //     name: "Sofia",
  //     tone: "Friendly and professional. Use light emojis. Address by name.",
  //     language: "español colombiano informal",
  //   },
  //   instagram: {
  //     name: "Sofi",
  //     tone: "Fun and trendy. More emojis. Use 'amiga' with female clients.",
  //     language: "español colombiano informal y juvenil",
  //   },
  // },
};
