import { describe, expect, it } from "vitest";
import { buscarVoseo } from "@/core/formas-voseo";

describe("buscarVoseo", () => {
  it("encuentra el voseo sin importar mayúsculas y dice en qué texto está", () => {
    expect(buscarVoseo(["¿Confirmás su pedido?", "Todo bien"])).toEqual(['"Confirmás" en: ¿Confirmás su pedido?']);
  });

  it("no confunde palabras que solo contienen una forma de voseo, ni el trato de usted", () => {
    expect(buscarVoseo(["Vosotros", "¿Confirma su pedido?", "Tiene 1 pedido", "Escríbanos", "acápite"])).toEqual([]);
  });
});
