/**
 * T-87: las piezas del chat de la landing en un solo lugar. Las usan el
 * teléfono del hero, la línea de tiempo de "Así funciona" y las pestañas de
 * "Para qué negocios". Así un cambio de estilo se ve igual en todas, y lo que
 * muestra cada sección se parece al teléfono que la dueña ya vio arriba.
 *
 * Sin estado ni efectos: sirven tanto en componentes de servidor como dentro
 * del componente de cliente de las pestañas.
 */

import type { ReactNode } from "react";

function unir(...clases: (string | false | undefined)[]): string {
  return clases.filter(Boolean).join(" ");
}

/** Burbuja de WhatsApp: la del cliente a la izquierda (blanca), la del negocio a la derecha (verde). */
export function Burbuja({
  de,
  children,
  className,
}: {
  de: "cliente" | "negocio";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={unir(
        "max-w-[86%] whitespace-pre-line rounded-lg px-2.5 py-1.5 text-[12.5px] leading-snug text-ink shadow-card",
        de === "cliente" ? "self-start rounded-bl-[3px] bg-white" : "self-end rounded-br-[3px] bg-wa-out",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Alturas de la onda de la nota de voz (px). Fijas: la misma forma en cada render. */
const ONDA = [6, 10, 14, 9, 16, 12, 7, 13, 18, 11, 8, 15, 10, 6, 12, 9, 14, 7];

/** Nota de voz del cliente, con onda y duración en Sora. */
export function NotaVoz({ duracion = "0:08", className }: { duracion?: string; className?: string }) {
  return (
    <div
      className={unir(
        "flex max-w-[78%] items-center gap-2 self-start rounded-lg rounded-bl-[3px] bg-white px-2.5 py-2 shadow-card",
        className,
      )}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-wa-header">
        <span className="ml-0.5 h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-white" />
      </span>
      <span className="flex h-[18px] items-center gap-[2px]">
        {ONDA.map((alto, i) => (
          <span key={i} className="w-[2px] rounded-full bg-ink-soft" style={{ height: alto }} />
        ))}
      </span>
      <span className="font-display text-[11px] font-semibold text-ink-mid">{duracion}</span>
    </div>
  );
}

/** Miniatura de comprobante genérico: sin logos de bancos ni datos reales. */
export function ComprobanteMini({ monto, className }: { monto: string; className?: string }) {
  return (
    <div className={unir("w-[58%] min-w-[150px] self-start rounded-lg rounded-bl-[3px] bg-white p-1.5 shadow-card", className)}>
      <div className="rounded-md border border-line bg-surface-3 px-2.5 py-2">
        <p className="text-[9.5px] font-bold uppercase tracking-wide text-ink-mid">Comprobante</p>
        <p className="font-display text-[17px] font-bold text-ink">{monto}</p>
        <span className="mt-1 block h-1.5 w-4/5 rounded-full bg-line-2" />
        <span className="mt-1 block h-1.5 w-3/5 rounded-full bg-line-2" />
      </div>
    </div>
  );
}

/** Aviso de Nexo cuando algo no cuadra (tokens warn). */
export function AvisoAmbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={unir(
        "self-center rounded-md bg-warn-bg px-2.5 py-1 text-center text-[11px] font-semibold leading-snug text-warn-ink shadow-card",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Botones de respuesta rápida bajo un mensaje del negocio (no son botones reales: es una ilustración). */
export function RespuestasRapidas({ opciones, className }: { opciones: string[]; className?: string }) {
  return (
    <div className={unir("flex flex-wrap justify-end gap-1.5 self-end", className)}>
      {opciones.map((o) => (
        <span key={o} className="rounded-full bg-white px-3 py-1 text-[11.5px] font-semibold text-wa-header shadow-card">
          {o}
        </span>
      ))}
    </div>
  );
}

/** Marca de turnos omitidos: deja claro que la conversación real tiene más pasos en el medio. */
export function TurnosOmitidos({ texto }: { texto: string }) {
  return (
    <p className="self-center px-2 text-center text-[11px] font-semibold text-ink-mid">
      <span aria-hidden>· · · </span>
      {texto}
      <span aria-hidden> · · ·</span>
    </p>
  );
}

/** Fondo de chat sin marco de teléfono (las escenas pequeñas de la página). */
export function FondoChat({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={unir("flex flex-col gap-2 rounded-2xl bg-wa-bg p-3", className)}>{children}</div>;
}
