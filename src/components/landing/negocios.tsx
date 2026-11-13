import { Scissors, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { Seccion } from "@/components/landing/seccion";

/** T-80: mismos colores e iconos de rubro que el portal (`rubro-visual.tsx`), para que la dueña reconozca su tarjeta después. */
const NEGOCIOS = [
  {
    titulo: "Restaurantes y comidas",
    texto: "Pedidos a domicilio o para recoger, con código de retiro.",
    Icono: UtensilsCrossed,
    colores: "bg-rubro-gastro-bg text-rubro-gastro-ink",
  },
  {
    titulo: "Barberías, salones y estética",
    texto: "Citas agendadas mientras usted atiende.",
    Icono: Scissors,
    colores: "bg-rubro-servicios-bg text-rubro-servicios-ink",
  },
  {
    titulo: "Tiendas",
    texto: "Pedidos con inventario: no vende lo que ya no tiene.",
    Icono: ShoppingBag,
    colores: "bg-rubro-comercio-bg text-rubro-comercio-ink",
  },
];

export function Negocios() {
  return (
    <Seccion id="negocios" titulo="Para qué negocios">
      <ul className="mt-8 grid gap-4 sm:grid-cols-3">
        {NEGOCIOS.map(({ titulo, texto, Icono, colores }) => (
          <li key={titulo} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <span className={`inline-flex h-12 w-12 items-center justify-center rounded-[14px] ${colores}`}>
              <Icono className="h-6 w-6" aria-hidden />
            </span>
            <h3 className="mt-4 text-[17px] font-bold text-ink">{titulo}</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink-mid">{texto}</p>
          </li>
        ))}
      </ul>
    </Seccion>
  );
}
