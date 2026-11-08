/**
 * T-72: pantalla común para "no encontrada" y "algo salió mal". Antes salían
 * las de Next, en inglés y en blanco, que se ven como si la app se hubiera
 * roto. Mismo fondo de marca que la landing y el login, y siempre una salida
 * clara (ir al inicio o a los negocios) para que nadie quede atrapado.
 *
 * Sin hooks a propósito: la usan un Server Component (`not-found`) y un
 * Client Component (`error`).
 */

import { Logo } from "@/components/logo";

export function PantallaError({
  codigo,
  titulo,
  texto,
  children,
  detalle,
}: {
  codigo: string;
  titulo: string;
  texto: string;
  /** Los botones de salida. */
  children: React.ReactNode;
  /** Línea chica al pie (p. ej. el código del error para soporte). */
  detalle?: string;
}) {
  return (
    <main
      className="flex min-h-screen flex-col"
      style={{
        background:
          "radial-gradient(70% 55% at 15% 0%, rgba(42,111,219,.4) 0%, rgba(14,32,51,0) 65%), #0E2033",
      }}
    >
      <header className="px-6 py-6 sm:px-10">
        <Logo variant="dark" />
      </header>
      <section className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center px-6 pb-24 fade-up">
        <p className="font-display text-[88px] font-extrabold leading-none text-white/15 sm:text-[120px]">{codigo}</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold text-white sm:text-4xl">{titulo}</h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/70">{texto}</p>
        <div className="mt-8 flex flex-wrap gap-3">{children}</div>
        {detalle && <p className="mt-10 text-xs text-white/40">{detalle}</p>}
      </section>
    </main>
  );
}

export const botonPrincipal =
  "inline-flex items-center rounded-[10px] bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover";
export const botonSecundario =
  "inline-flex items-center rounded-[10px] border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10";
