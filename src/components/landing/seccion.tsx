/** T-80: contenedor común de las secciones de la landing (ancho, márgenes y título). */

export function Seccion({
  id,
  titulo,
  oscura = false,
  children,
}: {
  id?: string;
  titulo?: string;
  /** Fondo de marca (#0E2033) en vez del lienzo claro. */
  oscura?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id && titulo ? `${id}-titulo` : undefined}
      className={oscura ? "bg-[#0E2033] text-white" : "text-ink"}
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        {titulo && (
          <h2
            id={id ? `${id}-titulo` : undefined}
            className={`max-w-2xl text-[26px] font-extrabold leading-tight sm:text-[34px] ${oscura ? "text-white" : "text-ink"}`}
          >
            {titulo}
          </h2>
        )}
        {children}
      </div>
    </section>
  );
}
