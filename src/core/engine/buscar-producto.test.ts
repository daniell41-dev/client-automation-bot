import { describe, expect, it } from "vitest";
import { buscarProducto } from "@/core/engine/buscar-producto";
import type { ImageDescription } from "@/core/ai/image-schema";
import type { Service } from "@/core/types";

function descripcion(overrides: Partial<ImageDescription> = {}): ImageDescription {
  return {
    tipoProducto: "producto",
    textoVisible: [],
    esRecipeMedico: false,
    confianza: "media",
    ...overrides,
  };
}

const repuestos: Service[] = [
  {
    id: "filtro-aceite-toyota",
    name: "Filtro de aceite Toyota",
    description: "Filtro de aceite para motor 1.8, referencia FA-2201",
    price: 45000,
    categoria: "Filtros",
    keywords: ["fa-2201", "filtro aceite toyota"],
  },
  {
    id: "filtro-aire-mazda",
    name: "Filtro de aire Mazda",
    description: "Filtro de aire, referencia FR-100",
    price: 38000,
    categoria: "Filtros",
    keywords: ["fr-100", "filtro aire mazda"],
  },
  {
    id: "bujia-ngk",
    name: "Bujía NGK",
    description: "Bujía de encendido estándar",
    price: 12000,
    categoria: "Encendido",
    keywords: ["bujia ngk"],
  },
];

const farmacia: Service[] = [
  {
    id: "acetaminofen-mk",
    name: "Acetaminofén MK 500mg",
    description: "Analgésico y antipirético, caja x 20 tabletas",
    price: 8000,
    categoria: "Analgésicos",
    keywords: ["acetaminofen"],
  },
  {
    id: "ibuprofeno-genfar",
    name: "Ibuprofeno Genfar 400mg",
    description: "Antiinflamatorio, caja x 10 tabletas",
    price: 9500,
    categoria: "Antiinflamatorios",
    keywords: ["ibuprofeno"],
  },
  {
    id: "vitamina-c-mk",
    name: "Vitamina C MK",
    description: "Suplemento, caja x 30 tabletas",
    price: 15000,
    categoria: "Vitaminas",
    disponible: false,
    keywords: ["vitamina c"],
  },
];

describe("buscarProducto — prioridad 1: referencia exacta (repuestos)", () => {
  it("hace match por el código de referencia leído en la foto", () => {
    const result = buscarProducto(
      descripcion({ tipoProducto: "filtro", textoVisible: ["FA-2201", "TOYOTA"] }),
      repuestos,
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("filtro-aceite-toyota");
  });

  it("la referencia gana aunque también matchee categoría de otro ítem", () => {
    const result = buscarProducto(
      descripcion({ tipoProducto: "filtro", categoria: "filtros", textoVisible: ["FR-100"] }),
      repuestos,
    );
    expect(result.map((s) => s.id)).toEqual(["filtro-aire-mazda"]);
  });

  it("es tolerante a mayúsculas/tildes en el texto visible", () => {
    const result = buscarProducto(
      descripcion({ textoVisible: ["Bujía NGK", "ref: xyz"] }),
      repuestos,
    );
    expect(result.map((s) => s.id)).toEqual(["bujia-ngk"]);
  });
});

describe("buscarProducto — prioridad 2: marca + tipo (farmacia)", () => {
  it("hace match por marca + tipo de producto cuando no hay texto visible útil", () => {
    const result = buscarProducto(
      descripcion({ tipoProducto: "ibuprofeno", marca: "Genfar" }),
      farmacia,
    );
    expect(result.map((s) => s.id)).toEqual(["ibuprofeno-genfar"]);
  });

  it("no matchea si la marca coincide pero el tipo no", () => {
    const result = buscarProducto(
      descripcion({ tipoProducto: "vitamina", marca: "Genfar" }),
      farmacia,
    );
    expect(result).toEqual([]);
  });

  it("nunca devuelve un ítem con disponible === false, aunque matchee", () => {
    const result = buscarProducto(
      descripcion({ tipoProducto: "vitamina", marca: "MK" }),
      farmacia,
    );
    expect(result.some((s) => s.id === "vitamina-c-mk")).toBe(false);
  });
});

describe("buscarProducto — prioridad 3: solo categoría", () => {
  it("con solo categoría devuelve hasta 3 candidatos ambiguos", () => {
    const result = buscarProducto(descripcion({ categoria: "Filtros" }), repuestos);
    expect(result.map((s) => s.id).sort()).toEqual(["filtro-aceite-toyota", "filtro-aire-mazda"]);
  });

  it("recorta a 3 candidatos como máximo", () => {
    const muchos: Service[] = Array.from({ length: 5 }, (_, i) => ({
      id: `item-${i}`,
      name: `Producto ${i}`,
      description: "x",
      price: 1000,
      categoria: "Varios",
    }));
    const result = buscarProducto(descripcion({ categoria: "Varios" }), muchos);
    expect(result).toHaveLength(3);
  });
});

describe("buscarProducto — prioridad 4: sin match", () => {
  it("devuelve [] si no hay texto visible útil, ni marca+tipo, ni categoría que matcheen", () => {
    const result = buscarProducto(
      descripcion({ tipoProducto: "algo raro", categoria: "Inexistente" }),
      repuestos,
    );
    expect(result).toEqual([]);
  });

  it("devuelve [] con un catálogo vacío", () => {
    expect(buscarProducto(descripcion(), [])).toEqual([]);
  });

  it("devuelve [] cuando la descripción no trae marca ni categoría ni texto útil", () => {
    expect(buscarProducto(descripcion({ tipoProducto: "algo" }), farmacia)).toEqual([]);
  });
});
