import { describe, expect, it } from "vitest";
import { catalogoMixto, esCita, modoDelItem } from "@/core/engine/modo-item";
import type { CatalogoConfig, Service } from "@/core/types";

function item(overrides: Partial<Service> = {}): Service {
  return {
    id: "x",
    name: "Ítem",
    description: "",
    price: 1000,
    ...overrides,
  };
}

describe("modoDelItem — los tres escalones", () => {
  it("1) `modo` declarado en el ítem gana sobre todo lo demás", () => {
    const catalogo: CatalogoConfig = { modoPorDefecto: "pedido" };
    // Contradice al rubro Y al flag reservable: igual manda el ítem.
    expect(modoDelItem(item({ modo: "cita", reservable: false }), catalogo)).toBe("cita");
    expect(modoDelItem(item({ modo: "pedido", reservable: true }), catalogo)).toBe("pedido");
  });

  it("2) sin `modo`, `reservable: true` significa cita (es el caso de estética)", () => {
    expect(modoDelItem(item({ reservable: true }))).toBe("cita");
    // Incluso si el rubro vende por defecto: el ítem dijo que se reserva.
    expect(modoDelItem(item({ reservable: true }), { modoPorDefecto: "pedido" })).toBe("cita");
  });

  it("3) sin nada del ítem, decide el rubro", () => {
    expect(modoDelItem(item(), { modoPorDefecto: "pedido" })).toBe("pedido");
    expect(modoDelItem(item(), { modoPorDefecto: "cita" })).toBe("cita");
  });

  it("sin ítem ni rubro declarados, sigue siendo cita — el comportamiento previo a T-21", () => {
    // Esta es la garantía de que ningún negocio ya cargado cambia de camino
    // al desplegar: sin `modo`, sin `reservable` y sin `catalogo`, todo se
    // comporta como antes.
    expect(modoDelItem(item())).toBe("cita");
    expect(modoDelItem(item(), {})).toBe("cita");
  });

  it("`reservable: false` explícito no fuerza pedido por sí solo: decide el rubro", () => {
    // `reservable` solo tiene valor afirmativo (era "aparece en reservables").
    // Un `false` con un rubro que agenda sigue siendo cita.
    expect(modoDelItem(item({ reservable: false }))).toBe("cita");
    expect(modoDelItem(item({ reservable: false }), { modoPorDefecto: "pedido" })).toBe("pedido");
  });
});

describe("esCita", () => {
  it("es el mismo criterio que modoDelItem, en forma de pregunta", () => {
    expect(esCita(item({ reservable: true }))).toBe(true);
    expect(esCita(item(), { modoPorDefecto: "pedido" })).toBe(false);
  });
});

describe("catalogoMixto — el caso del taller", () => {
  it("detecta un negocio con los dos caminos (agenda el service, vende el repuesto)", () => {
    const taller: Service[] = [
      item({ id: "cambio-aceite", reservable: true, durationMinutes: 60 }),
      item({ id: "filtro-aceite", stock: 12 }),
    ];
    expect(catalogoMixto(taller, { modoPorDefecto: "pedido" })).toBe(true);
  });

  it("estética no es mixto: todos sus servicios se reservan", () => {
    const estetica: Service[] = [
      item({ id: "facial", reservable: true, durationMinutes: 60 }),
      item({ id: "unas", reservable: true, durationMinutes: 45 }),
    ];
    expect(catalogoMixto(estetica)).toBe(false);
  });

  it("una tienda tampoco es mixta: todo se vende", () => {
    const tienda: Service[] = [item({ id: "harina" }), item({ id: "aceite" })];
    expect(catalogoMixto(tienda, { modoPorDefecto: "pedido" })).toBe(false);
  });

  it("un catálogo vacío no es mixto", () => {
    expect(catalogoMixto([])).toBe(false);
  });
});
