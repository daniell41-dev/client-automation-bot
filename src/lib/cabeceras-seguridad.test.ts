import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { CABECERAS_SEGURIDAD } from "@/lib/cabeceras-seguridad";

const valor = (clave: string) => CABECERAS_SEGURIDAD.find((c) => c.key === clave)?.value;

describe("T-97: cabeceras de seguridad", () => {
  it("ninguna otra página puede mostrar la app dentro de un marco (clickjacking)", () => {
    expect(valor("X-Frame-Options")).toBe("DENY");
    expect(valor("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });

  it("HTTPS obligatorio por dos años, también para www", () => {
    expect(valor("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains");
  });

  it("el navegador no adivina tipos de archivo ni filtra rutas privadas al salir", () => {
    expect(valor("X-Content-Type-Options")).toBe("nosniff");
    expect(valor("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("sin cámara, micrófono, ubicación ni pagos del navegador (la app no los usa)", () => {
    const permisos = valor("Permissions-Policy")!;
    for (const p of ["camera=()", "microphone=()", "geolocation=()", "payment=()"]) expect(permisos).toContain(p);
  });

  it("se aplican a todas las rutas y no se anuncia la versión del framework", async () => {
    const reglas = await nextConfig.headers!();
    expect(reglas).toEqual([{ source: "/:path*", headers: CABECERAS_SEGURIDAD }]);
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
