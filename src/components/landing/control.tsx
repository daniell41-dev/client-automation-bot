import { ShieldCheck } from "lucide-react";
import { Seccion } from "@/components/landing/seccion";

/** T-80: responde la duda que frena la compra ("¿y si se equivoca?") con lo que el sistema de verdad garantiza. */
const GARANTIAS = [
  "Ningún pedido pasa sin resumen: el cliente ve el total y confirma.",
  "Ningún pedido se despacha sin su aprobación.",
  "Ve todas las conversaciones desde el celular y puede pausar el bot.",
  "No inventa precios ni cuentas de pago.",
];

export function Control() {
  return (
    <div className="bg-primary-tint">
      <Seccion id="control" titulo="Usted tiene el control">
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {GARANTIAS.map((g) => (
            <li key={g} className="flex items-start gap-3 rounded-2xl bg-surface p-4 shadow-card">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
              <span className="text-[16px] font-semibold leading-snug text-ink">{g}</span>
            </li>
          ))}
        </ul>
      </Seccion>
    </div>
  );
}
