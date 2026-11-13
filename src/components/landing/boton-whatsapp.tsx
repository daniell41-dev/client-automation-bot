/**
 * T-80: el botón que la landing quiere que toquen. Lleva el icono genérico de
 * chat de lucide y la palabra "WhatsApp" escrita, no el logo de WhatsApp (es
 * marca de Meta y no se puede usar sin permiso).
 *
 * Sin número configurado, `enlaceWhatsApp` devuelve /demo: el botón sigue
 * llevando a algún lado útil en vez de abrir un chat roto.
 */

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { WHATSAPP_VENTAS } from "@/app/landing-config";
import { enlaceWhatsApp, type OrigenWhatsApp } from "@/lib/enlace-whatsapp";

export function BotonWhatsApp({
  origen,
  className = "",
}: {
  origen: OrigenWhatsApp;
  className?: string;
}) {
  const href = enlaceWhatsApp(origen, WHATSAPP_VENTAS);
  const clases = `inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] bg-primary px-6 py-3 text-[15px] font-bold text-white shadow-fab transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-light ${className}`;
  const contenido = (
    <>
      <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
      Escríbanos por WhatsApp
    </>
  );

  if (href.startsWith("https://")) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={clases} data-origen={origen}>
        {contenido}
      </a>
    );
  }
  return (
    <Link href={href} className={clases} data-origen={origen}>
      {contenido}
    </Link>
  );
}
