/**
 * T-86: quién está detrás. La dueña decide por confianza, y lo que más confianza
 * da en Cúcuta es saber que hay una persona que va al negocio, no una empresa
 * sin cara. Por eso la sección solo existe con un nombre y una foto reales
 * (`RESPONSABLE` en landing-config.ts): sin alguno de los dos, no se muestra.
 * Nunca con datos de ejemplo.
 *
 * La foto se revisa al compilar (como el video del hero): la página es
 * estática y no debe quedar una imagen rota.
 */

import Image from "next/image";
import { RESPONSABLE, type Responsable as DatosResponsable } from "@/app/landing-config";
import { Seccion } from "@/components/landing/seccion";
import { existeEnPublic } from "@/lib/archivo-publico";

/** La sección y la foto del cierre aparecen solo con nombre y con la foto subida. */
export function responsableVisible(r: DatosResponsable, hayFoto: boolean): r is DatosResponsable & { nombre: string } {
  return Boolean(r.nombre?.trim()) && hayFoto;
}

/** Los mismos compromisos que la tarjeta de precio y los Términos: una visita, 14 días, sin permanencia. */
const DATOS = [
  { numero: "1", texto: "visita para instalarlo" },
  { numero: "14", texto: "días de prueba" },
  { numero: "0", texto: "contratos de permanencia" },
];

export function Responsable({
  responsable = RESPONSABLE,
  hayFoto = existeEnPublic(RESPONSABLE.foto),
}: {
  responsable?: DatosResponsable;
  hayFoto?: boolean;
}) {
  if (!responsableVisible(responsable, hayFoto)) return null;

  return (
    <Seccion id="responsable">
      <div className="grid items-center gap-10 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:gap-14">
        <Image
          src={responsable.foto}
          alt={`Foto de ${responsable.nombre}`}
          width={640}
          height={800}
          sizes="(min-width: 768px) 320px, 100vw"
          className="aspect-[4/5] w-full max-w-[280px] rounded-3xl object-cover shadow-lift md:max-w-none"
        />

        <div>
          <h2 id="responsable-titulo" className="text-[28px] font-extrabold leading-tight text-ink sm:text-[36px]">
            Detrás de Nexo hay una persona de Cúcuta.
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-ink-mid sm:text-[18px]">
            {responsable.nombre}. Voy a su negocio, lo instalo con usted y le dejo mi WhatsApp para lo que necesite.
          </p>
          {responsable.piloto?.trim() && (
            <p className="mt-4 border-l-2 border-primary pl-3 text-[14px] leading-relaxed text-ink-mid">{responsable.piloto}</p>
          )}

          <ul className="mt-8 grid grid-cols-3 divide-x divide-line-2 border-y border-line-2">
            {DATOS.map((d) => (
              <li key={d.texto} className="px-2 py-4 text-center first:pl-0 last:pr-0 sm:px-4">
                <span className="block font-display text-[34px] font-bold leading-none text-ink sm:text-[40px]">{d.numero}</span>
                <span className="mt-1.5 block text-[13px] leading-snug text-ink-mid sm:text-[14px]">{d.texto}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Seccion>
  );
}
