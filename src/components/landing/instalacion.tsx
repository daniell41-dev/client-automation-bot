import { Pasos } from "@/components/landing/pasos";
import { Seccion } from "@/components/landing/seccion";
import { textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (landing.instalacion). */
const tt = textos.landing.instalacion;

export function Instalacion() {
  return (
    <Seccion id="instalacion" titulo={tt.comoEsLaInstalacion}>
      <Pasos pasos={tt.pasos} />
    </Seccion>
  );
}
