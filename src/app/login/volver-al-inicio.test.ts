/**
 * Quien entra al login desde la página de venta tiene que poder volver a ella
 * sin el botón "atrás" del navegador: el logo y un enlace llevan a "/".
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// El formulario usa la navegación de Next (searchParams); aquí solo interesa el marco.
vi.mock("./login-form", () => ({ LoginForm: () => null }));
vi.mock("@/components/action-form", () => ({ ActionForm: () => null }));
vi.mock("./recuperar/actions", () => ({ pedirRecuperacion: async () => undefined }));

import LoginPage from "./page";
import RecuperarPage from "./recuperar/page";

/** Las etiquetas <a> que llevan a "/", sin depender del orden de los atributos. */
const enlacesAlInicio = (html: string) => [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]).filter((a) => a.includes('href="/"'));

describe("salida al inicio desde el login", () => {
  it("login: enlace «Volver al inicio» y el logo (celular y escritorio) llevan a /", () => {
    const html = renderToStaticMarkup(createElement(LoginPage));
    const enlaces = enlacesAlInicio(html);
    // Logo de la franja del celular + logo del panel de escritorio + «Volver al inicio».
    expect(enlaces.filter((a) => a.includes('aria-label="Ir al inicio de Aurela"')).length).toBeGreaterThanOrEqual(2);
    expect(html).toMatch(/href="\/"[^>]*>(?:(?!<\/a>)[\s\S])*Volver al inicio/);
  });

  it("recuperar contraseña: el logo lleva a / y sigue el enlace al login", () => {
    const html = renderToStaticMarkup(createElement(RecuperarPage));
    expect(enlacesAlInicio(html).some((a) => a.includes('aria-label="Ir al inicio de Aurela"'))).toBe(true);
    expect(html).toContain('href="/login"');
  });
});
