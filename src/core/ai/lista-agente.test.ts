/**
 * T-152: en la prueba real con los 116 jeans la IA escribió un párrafo largo
 * para ofrecer tres opciones, y ante "chaquetas" (que no hay) empujó un jean
 * cualquiera. Aquí se prueba lo que hace el MOTOR: la lista la arma el código
 * con el precio del catálogo, y si lo pedido no existe se muestran las
 * categorías.
 */

import { describe, expect, it } from "vitest";
import { runAgentTurn } from "@/core/ai/agent";
import type { AgentResponse } from "@/core/ai/agent-schema";
import type { AgentTurnInput, ILLMProvider } from "@/core/ai/provider";
import type { BusinessConfig, IncomingMessage, PersonaConfig, Service } from "@/core/types";

const CATEGORIAS = ["Skinny", "Short", "Bota", "Overol", "Mom"];
// 45 productos (más que el umbral de catálogo grande) con el relleno del catálogo real.
const services: Service[] = Array.from({ length: 45 }, (_, i) => {
  const categoria = CATEGORIAS[i % CATEGORIAS.length];
  return {
    id: `ref-b${100 + i}`,
    name: `${categoria} dama jean stretch tiro alto modelo${i} tono azul`,
    description: "",
    price: 100000 + i * 1000,
    modo: "pedido",
    referencia: `B${100 + i}`,
    categoria,
  };
});

const config: BusinessConfig = {
  slug: "jeans",
  name: "Jeans al por mayor",
  currency: "COP",
  locale: "es-CO",
  services,
  messages: {
    welcome: "¿Qué busca?",
    askName: "¿A nombre de quién?",
    askDate: "¿Fecha?",
    askConfirm: "¿Confirma?",
    serviceInfo: "{{servicio}} {{precio}}",
    captured: "Listo {{nombre}}",
    fallback: "No le entendí",
  },
  followUps: [],
};

const persona: PersonaConfig = { name: "Ana", tone: "cálida", language: "español de Colombia" };
const now = new Date("2026-11-27T15:00:00.000Z");
const msg = (text: string): IncomingMessage => ({
  channel: "mock",
  businessSlug: "jeans",
  from: "573000000001",
  text,
  timestamp: now.toISOString(),
});

function ia(r: AgentResponse, vista?: (input: AgentTurnInput) => void): ILLMProvider {
  return {
    async enhance(ctx) {
      return ctx.draftResponse;
    },
    async extractDateTime() {
      return null;
    },
    async interpret() {
      return null;
    },
    async runAgent(input) {
      vista?.(input);
      return r;
    },
  };
}

const turno = async (texto: string, r: AgentResponse) =>
  (await runAgentTurn(null, msg(texto), config, ia(r), persona, [], now))!.messages[0].text.replace(/ /g, " ");

describe("T-152: lista de productos armada por el código", () => {
  it("con mostrar_productos, el texto de la IA va seguido de una línea por producto con el precio real", async () => {
    const texto = await turno("tienen skinny?", {
      respuesta: "¡Claro! Estas son algunas opciones:",
      acciones: [{ tipo: "mostrar_productos", servicioIds: ["ref-b100", "ref-b105", "no-existe"] }],
    });
    expect(texto).toBe(
      "¡Claro! Estas son algunas opciones:\n\n1. B100 · Skinny modelo0 · $ 100.000\n2. B105 · Skinny modelo5 · $ 105.000",
    );
  });

  it("no pasa de 8 opciones y no repite productos", async () => {
    const ids = services.slice(0, 12).map((s) => s.id);
    const texto = await turno("tienen skinny?", {
      respuesta: "Le muestro:",
      acciones: [{ tipo: "mostrar_productos", servicioIds: [ids[0], ids[0], ...ids] }],
    });
    expect(texto.split("\n").filter((l) => /^\d+\. /.test(l))).toHaveLength(8);
  });

  it("con un solo producto válido no se arma lista (la IA ya lo nombró)", async () => {
    const texto = await turno("la B100", {
      respuesta: "La B100 cuesta $100.000.",
      acciones: [{ tipo: "mostrar_productos", servicioIds: ["ref-b100"] }],
    });
    expect(texto).toBe("La B100 cuesta $100.000.");
  });
});

describe("T-152: lo que no está en el catálogo", () => {
  it("«chaquetas» muestra las categorías y no una lista de jeans", async () => {
    const texto = await turno("tienen chaquetas?", {
      respuesta: "No manejamos chaquetas, pero le puedo ayudar con nuestros jeans.",
      acciones: [{ tipo: "mostrar_productos", servicioIds: ["ref-b100", "ref-b101"] }],
    });
    expect(texto).toBe(
      "No manejamos chaquetas, pero le puedo ayudar con nuestros jeans.\n\nLo que manejamos: Skinny, Short, Bota, Overol y Mom.",
    );
  });

  it("si la IA ya nombró las categorías, no se repiten", async () => {
    const respuesta = "No tenemos chaquetas; manejamos Skinny, Short, Bota, Overol y Mom.";
    expect(await turno("tienen chaquetas?", { respuesta, acciones: [] })).toBe(respuesta);
  });
});
