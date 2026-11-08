import { CONTACTO_LEGAL, RESPONSABLES } from "@/lib/legal";

/** T-70: los datos del responsable, iguales en todas las páginas legales. */
export function BloqueResponsable() {
  return (
    <div className="recuadro">
      <p style={{ marginTop: 0 }}>
        <strong>Responsables:</strong> {RESPONSABLES.join(" y ")}, personas naturales, que operan Nexo.
      </p>
      <p>
        <strong>Dirección:</strong> {CONTACTO_LEGAL.direccion}
      </p>
      <p>
        <strong>Correo:</strong> <a href={`mailto:${CONTACTO_LEGAL.correo}`}>{CONTACTO_LEGAL.correo}</a>
      </p>
      <p>
        <strong>Teléfono / WhatsApp:</strong> {CONTACTO_LEGAL.telefonos.join(" · ")}
      </p>
    </div>
  );
}
