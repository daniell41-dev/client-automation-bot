import { describe, expect, it } from "vitest";
import { errorLlaveWompi } from "@/core/payments/wompi-llaves";

describe("errorLlaveWompi (T-49)", () => {
  it("acepta las llaves con el prefijo de Wompi", () => {
    expect(errorLlaveWompi("public_key", "pub_test_Abc123")).toBeNull();
    expect(errorLlaveWompi("integrity_secret", "prod_integrity_Xyz9")).toBeNull();
    expect(errorLlaveWompi("events_secret", "test_events_Q1")).toBeNull();
  });

  it("rechaza lo que autocompleta el navegador (correo y contraseña)", () => {
    expect(errorLlaveWompi("public_key", "saboresdelsur@gmail.com")).toContain("llave pública");
    expect(errorLlaveWompi("integrity_secret", "MiClave123")).toContain("secreto de integridad");
  });

  it("no confunde un secreto con otro", () => {
    expect(errorLlaveWompi("events_secret", "test_integrity_abc")).not.toBeNull();
  });
});
