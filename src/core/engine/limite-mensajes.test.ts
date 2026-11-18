import { describe, expect, it } from "vitest";
import { LimitadorMensajes, LIMITES_POR_DEFECTO } from "@/core/engine/limite-mensajes";

const t0 = new Date("2026-11-18T15:00:00.000Z").getTime();
const en = (ms: number) => new Date(t0 + ms);

describe("T-99: límite de mensajes por número", () => {
  it("un cliente normal que escribe en ráfaga corta no se frena", () => {
    const l = new LimitadorMensajes();
    for (let i = 0; i < 10; i++) expect(l.registrar("sabores", "573001", en(i * 1000))).toBe("ok");
  });

  it("al pasar el tope por minuto: avisa una vez y después silencio", () => {
    const l = new LimitadorMensajes({ porMinuto: 3, porHora: 100 });
    for (let i = 0; i < 3; i++) expect(l.registrar("sabores", "573001", en(i))).toBe("ok");
    expect(l.registrar("sabores", "573001", en(10))).toBe("avisar");
    expect(l.registrar("sabores", "573001", en(20))).toBe("silencio");
    expect(l.registrar("sabores", "573001", en(30))).toBe("silencio");
  });

  it("cuando la ventana se libera vuelve a atender (y a poder avisar)", () => {
    const l = new LimitadorMensajes({ porMinuto: 2, porHora: 100 });
    l.registrar("sabores", "573001", en(0));
    l.registrar("sabores", "573001", en(1));
    expect(l.registrar("sabores", "573001", en(2))).toBe("avisar");
    expect(l.registrar("sabores", "573001", en(61_000))).toBe("ok");
    l.registrar("sabores", "573001", en(61_001));
    expect(l.registrar("sabores", "573001", en(61_002))).toBe("avisar");
  });

  it("los mensajes bloqueados no cuentan: un bucle sin fin no deja la ventana tomada", () => {
    const l = new LimitadorMensajes({ porMinuto: 2, porHora: 100 });
    l.registrar("sabores", "573001", en(0));
    l.registrar("sabores", "573001", en(1));
    for (let i = 2; i < 500; i++) l.registrar("sabores", "573001", en(i * 100));
    expect(l.registrar("sabores", "573001", en(60_001))).toBe("ok");
  });

  it("el tope por hora frena el goteo sostenido aunque no haya ráfagas", () => {
    const l = new LimitadorMensajes({ porMinuto: 100, porHora: 5 });
    for (let i = 0; i < 5; i++) expect(l.registrar("sabores", "573001", en(i * 5 * 60_000))).toBe("ok");
    expect(l.registrar("sabores", "573001", en(30 * 60_000))).toBe("avisar");
  });

  it("cada número y cada negocio llevan su propia cuenta", () => {
    const l = new LimitadorMensajes({ porMinuto: 1, porHora: 100 });
    expect(l.registrar("sabores", "573001", en(0))).toBe("ok");
    expect(l.registrar("sabores", "573002", en(0))).toBe("ok");
    expect(l.registrar("otro", "573001", en(0))).toBe("ok");
    expect(l.registrar("sabores", "573001", en(1))).toBe("avisar");
  });

  it("limpiar borra los números sin actividad en la última hora", () => {
    const l = new LimitadorMensajes();
    l.registrar("sabores", "573001", en(0));
    l.registrar("sabores", "573002", en(50 * 60_000));
    l.limpiar(en(61 * 60_000));
    expect(l.tamaño).toBe(1);
  });

  it("los topes por defecto dejan margen de sobra a un cliente real", () => {
    expect(LIMITES_POR_DEFECTO.porMinuto).toBeGreaterThanOrEqual(10);
    expect(LIMITES_POR_DEFECTO.porHora).toBeGreaterThanOrEqual(60);
  });
});
