/**
 * Rubros base de Nexo (T-40): las plantillas que el back office ofrece al
 * crear un negocio, y que la dueña elegirá en su primer ingreso (T-42).
 *
 * Son SOLO datos: precios y textos de ejemplo que la dueña reemplaza en el
 * portal. Lo que sí define cada rubro es la forma — si sus ítems se agendan
 * (belleza, peluquería, masajes) o se venden (restaurante), qué campos tiene
 * el catálogo y si pregunta domicilio o recoger. Todas pasan por
 * `businessConfigSchema` antes de guardarse (regla 5 de AGENTS.md); el test
 * de este archivo lo verifica.
 */

import type { BusinessConfig } from "@/core/types";
import { esteticaBella } from "@/businesses/estetica-bella/config";

export interface RubroBase {
  slug: string;
  nombre: string;
  descripcion: string;
  template: BusinessConfig;
}

/** Lun-Sáb 9:00-19:00, domingo cerrado: el horario más común en belleza. */
const HORARIO_SALON: BusinessConfig["horarios"] = [
  { dow: 0, abierto: false, tramos: [] },
  ...[1, 2, 3, 4, 5].map((dow) => ({ dow, abierto: true, tramos: [{ desde: "09:00", hasta: "19:00" }] })),
  { dow: 6, abierto: true, tramos: [{ desde: "09:00", hasta: "17:00" }] },
];

/** Mensajes de cita: comunes a los tres rubros que agendan. */
function mensajesCita(saludo: string): BusinessConfig["messages"] {
  return {
    welcome: `¡Hola! Gracias por escribirnos ${saludo} ¿Qué servicio te interesa?`,
    askName: "¡Perfecto! ¿Cuál es tu nombre? 😊",
    askDate: "Genial {{nombre}} ¿Qué día y hora te queda bien?",
    askConfirm: "¿Te confirmo tu cita de {{servicio}} para {{fecha}}, {{nombre}}?",
    serviceInfo: "{{servicio}}: {{descripcion}}\nDuración: {{duracion}}.\nPrecio: {{precio}}.",
    captured: "¡Listo {{nombre}}! ✨ Tu cita de {{servicio}} para {{fecha}} quedó agendada. Te esperamos.",
    fallback: "Disculpa, no te entendí 😅 ¿Qué servicio te interesa?",
  };
}

const BASE: Pick<BusinessConfig, "currency" | "locale" | "timezone" | "followUps" | "botActivo"> = {
  currency: "COP",
  locale: "es-CO",
  timezone: "America/Bogota",
  followUps: [],
  botActivo: false,
};

const belleza: BusinessConfig = {
  ...esteticaBella,
  ...BASE,
  slug: "estetica",
  name: "Estética",
  rubro: "Belleza / Estética",
  direccion: undefined,
  plan: undefined,
};

const peluqueria: BusinessConfig = {
  ...BASE,
  slug: "peluqueria",
  name: "Peluquería",
  rubro: "Peluquería / Barbería",
  catalogo: { etiqueta: { singular: "Servicio", plural: "Servicios" }, modoPorDefecto: "cita" },
  services: [
    { id: "corte-dama", name: "Corte dama", description: "Corte y secado.", price: 35000, durationMinutes: 45, keywords: ["corte", "dama", "pelo"], reservable: true },
    { id: "corte-caballero", name: "Corte caballero", description: "Corte con máquina y tijera.", price: 20000, durationMinutes: 30, keywords: ["corte", "caballero", "barba"], reservable: true },
    { id: "tinte", name: "Tinte", description: "Color completo con productos profesionales.", price: 90000, durationMinutes: 120, keywords: ["tinte", "color", "mechas"], reservable: true },
  ],
  messages: mensajesCita("✂️"),
  horarios: HORARIO_SALON,
  ai: { enabled: true, knowledge: "Peluquería y barbería. Atendemos con cita previa." },
};

const masajes: BusinessConfig = {
  ...BASE,
  slug: "masajes",
  name: "Masajes",
  rubro: "Masajes / Spa",
  catalogo: { etiqueta: { singular: "Servicio", plural: "Servicios" }, modoPorDefecto: "cita" },
  services: [
    { id: "relajante", name: "Masaje relajante", description: "Masaje de cuerpo completo con aceites.", price: 80000, durationMinutes: 60, keywords: ["relajante", "masaje", "cuerpo"], reservable: true },
    { id: "descontracturante", name: "Masaje descontracturante", description: "Trabajo profundo en espalda y cuello.", price: 95000, durationMinutes: 60, keywords: ["descontracturante", "espalda", "cuello", "dolor"], reservable: true },
  ],
  messages: mensajesCita("🌿"),
  horarios: HORARIO_SALON,
  ai: { enabled: true, knowledge: "Spa de masajes. Atendemos con cita previa." },
};

const restaurante: BusinessConfig = {
  ...BASE,
  slug: "restaurante",
  name: "Restaurante",
  rubro: "Restaurante",
  catalogo: {
    etiqueta: { singular: "Plato", plural: "Menú" },
    modoPorDefecto: "pedido",
    campos: { duracion: false, stock: true, categoria: true },
    stockMinimo: 3,
  },
  services: [
    { id: "bandeja-paisa", name: "Bandeja paisa", description: "Frijoles, arroz, carne molida, chicharrón, huevo, arepa y aguacate.", price: 28000, keywords: ["bandeja", "paisa"], categoria: "Platos fuertes" },
    { id: "limonada-coco", name: "Limonada de coco", description: "Limonada natural con coco, 16 oz.", price: 8000, keywords: ["limonada", "coco", "bebida"], categoria: "Bebidas" },
  ],
  messages: {
    welcome: "¡Hola! Bienvenido 🍽️ ¿Qué te gustaría pedir hoy?",
    askName: "¡Con gusto! ¿A nombre de quién va el pedido?",
    askDate: "¿Para qué hora lo querés?",
    askConfirm: "¿Te confirmo el pedido, {{nombre}}?",
    serviceInfo: "{{servicio}}: {{descripcion}} — {{precio}}.",
    captured: "¡Listo {{nombre}}! Tu pedido quedó registrado.",
    fallback: "Disculpa, no te entendí 😅 ¿Qué te gustaría pedir?",
  },
  pedidos: {
    enabled: true,
    pregunta: "¿Te lo mandamos a domicilio o lo recogés en el local?",
    opciones: ["Domicilio", "Recoger en el local"],
  },
  // El antifraude de pantallazos viene activado: es la razón por la que un
  // restaurante elige Nexo. La dueña carga su Nequi en Configuración.
  pagos: { requiereComprobante: true },
  horarios: [0, 1, 2, 3, 4, 5, 6].map((dow) => ({ dow, abierto: true, tramos: [{ desde: "11:00", hasta: "22:00" }] })),
  ai: { enabled: true, knowledge: "Restaurante con domicilios. Pagos por Nequi o Bre-B con comprobante." },
};

export const RUBROS_BASE: RubroBase[] = [
  { slug: "estetica", nombre: "Belleza / Estética", descripcion: "Salones de belleza: faciales, uñas, pestañas y depilación.", template: belleza },
  { slug: "peluqueria", nombre: "Peluquería / Barbería", descripcion: "Cortes, tintes y barba, con cita previa.", template: peluqueria },
  { slug: "masajes", nombre: "Masajes / Spa", descripcion: "Masajes y tratamientos de spa, con cita previa.", template: masajes },
  { slug: "restaurante", nombre: "Restaurante", descripcion: "Pedidos para domicilio o para recoger, con pago verificado y código de retiro.", template: restaurante },
];
