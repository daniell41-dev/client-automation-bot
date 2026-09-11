import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cached, invalidateBusinessCache } from "@/businesses/business-cache";

beforeEach(() => {
  invalidateBusinessCache();
});

describe("cached", () => {
  it("N llamadas con la misma key hacen 1 sola lectura", async () => {
    const fn = vi.fn(async () => ({ n: 1 }));

    await cached("k", fn);
    await cached("k", fn);
    await cached("k", fn);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("keys distintas se resuelven de forma independiente", async () => {
    const fnA = vi.fn(async () => "a");
    const fnB = vi.fn(async () => "b");

    expect(await cached("a", fnA)).toBe("a");
    expect(await cached("b", fnB)).toBe("b");
    expect(fnA).toHaveBeenCalledTimes(1);
    expect(fnB).toHaveBeenCalledTimes(1);
  });

  it("también cachea un resultado null (no repite un 'no existe')", async () => {
    const fn = vi.fn(async () => null);

    await cached("k", fn);
    await cached("k", fn);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("invalidateBusinessCache() fuerza a releer en la siguiente llamada", async () => {
    const fn = vi.fn(async () => ({ n: 1 }));

    await cached("k", fn);
    invalidateBusinessCache();
    await cached("k", fn);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("expira sola pasado el TTL, sin invalidación explícita", async () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn(async () => ({ n: 1 }));

      await cached("k", fn, 1000);
      await vi.advanceTimersByTimeAsync(500);
      await cached("k", fn, 1000); // todavía fresco
      expect(fn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(600); // pasó el TTL
      await cached("k", fn, 1000);
      expect(fn).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

afterEach(() => {
  invalidateBusinessCache();
});
