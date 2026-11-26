import { CONTACTO_LEGAL, RESPONSABLES } from "@/lib/legal";
import { textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (legal.responsable). */
const tt = textos.legal.responsable;

/** T-70: los datos del responsable, iguales en todas las páginas legales. */
export function BloqueResponsable() {
  return (
    <div className="recuadro">
      <p style={{ marginTop: 0 }}>
        <strong>{tt.responsables}</strong> {RESPONSABLES.join(tt.y)}{tt.personasNaturalesQueOperan}</p>
      <p>
        <strong>{tt.direccion}</strong> {CONTACTO_LEGAL.direccion}
      </p>
      <p>
        <strong>{tt.correo}</strong> <a href={`mailto:${CONTACTO_LEGAL.correo}`}>{CONTACTO_LEGAL.correo}</a>
      </p>
      <p>
        <strong>{tt.telefonoWhatsapp}</strong> {CONTACTO_LEGAL.telefonos.join(" · ")}
      </p>
    </div>
  );
}
