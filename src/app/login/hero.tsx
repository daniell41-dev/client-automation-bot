/**
 * Panel de marca del login (T-68). Antes era un titular y dos burbujas
 * genéricas con un hueco enorme en el medio: no mostraba qué hace Nexo. Ahora
 * es la venta real del producto en una sola imagen: un cliente pidiendo por
 * WhatsApp, el bot armando el resumen con total, el comprobante, el código de
 * retiro, y el aviso que le llega a la dueña. Los mismos textos que manda el
 * bot de verdad, para que la promesa sea la que el producto cumple.
 *
 * Sin JavaScript: las animaciones son CSS (y se apagan con
 * `prefers-reduced-motion`, ver `globals.css`).
 */

import { BadgeCheck, Bell, Clock3, Mic, ShieldCheck, Zap } from "lucide-react";
import { Logo } from "@/components/logo";

type Burbuja = { de: "cliente" | "bot"; texto: string; hora: string };

const CHAT: Burbuja[] = [
  { de: "cliente", texto: "Hola! Me das una bandeja paisa a domicilio?", hora: "12:01" },
  {
    de: "bot",
    texto: "¡Claro! 🍽️\n1x Bandeja paisa — $28.000\nDomicilio — $5.000\nTotal: $33.000\n¿Confirmás tu pedido?",
    hora: "12:01",
  },
  { de: "cliente", texto: "Sí 🙌 ya te mando el comprobante", hora: "12:02" },
  { de: "bot", texto: "Pedido #12 confirmado ✅\nCódigo de retiro: 4821", hora: "12:04" },
];

const BENEFICIOS = [
  { icono: Clock3, titulo: "24/7", texto: "Atiende mientras dormís" },
  { icono: ShieldCheck, titulo: "Pagos revisados", texto: "Alerta si algo no cuadra" },
  { icono: Mic, titulo: "Notas de voz", texto: "Entiende audios" },
];

function Telefono() {
  return (
    <div className="relative w-[300px] rounded-[38px] border border-white/15 bg-[#0b1726] p-2.5 shadow-[0_40px_80px_-30px_rgba(0,0,0,.8)]">
      <div className="overflow-hidden rounded-[30px] bg-wa-bg">
        {/* Encabezado tipo WhatsApp con el negocio de ejemplo */}
        <div className="flex items-center gap-2.5 bg-wa-header px-4 pb-3 pt-4 text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm">🍲</span>
          <div className="leading-tight">
            <p className="text-[13px] font-bold">Sabores del Sur</p>
            <p className="text-[10px] text-white/75">en línea</p>
          </div>
        </div>
        <div className="space-y-2 px-3 py-4">
          {CHAT.map((b, i) => (
            <div
              key={i}
              className={`login-burbuja flex ${b.de === "cliente" ? "justify-end" : "justify-start"}`}
              style={{ animationDelay: `${0.4 + i * 0.7}s` }}
            >
              <p
                className={`max-w-[85%] whitespace-pre-line rounded-lg px-2.5 pb-1 pt-1.5 text-[11.5px] leading-snug text-[#111b21] shadow-sm ${
                  b.de === "cliente" ? "rounded-tr-[3px] bg-wa-out" : "rounded-tl-[3px] bg-white"
                }`}
              >
                {b.texto}
                <span className="ml-2 inline-block translate-y-0.5 text-[9px] text-[#667781]">{b.hora}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LoginHero() {
  return (
    <section className="relative hidden flex-[1.05] flex-col justify-between overflow-hidden bg-[#0E2033] p-10 lg:flex">
      {/* Fondo: dos luces y una grilla de puntos que se desvanece. Le da
          profundidad sin competir con el teléfono, que es el protagonista. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 15% 0%, rgba(42,111,219,.45) 0%, rgba(14,32,51,0) 70%), radial-gradient(45% 40% at 95% 85%, rgba(18,183,106,.18) 0%, rgba(14,32,51,0) 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[.18]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,.55) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(70% 70% at 60% 50%, #000 0%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(70% 70% at 60% 50%, #000 0%, transparent 75%)",
        }}
      />

      <div className="relative">
        <Logo variant="dark" />
      </div>

      <div className="relative grid grid-cols-1 items-center gap-10 xl:grid-cols-[1fr_auto]">
        <div className="max-w-md">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
            <Zap className="h-3.5 w-3.5 text-primary-light" />
            Tu asistente de ventas en WhatsApp
          </span>
          <h1 className="mt-5 font-display text-[40px] font-extrabold leading-[1.08] text-white">
            Tu negocio vende por WhatsApp{" "}
            <span className="bg-gradient-to-r from-primary-light to-[#5ee6b0] bg-clip-text text-transparent">
              las 24 horas.
            </span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            Nexo responde, arma el pedido con el total, revisa el comprobante y te avisa para que solo
            tengas que aprobar.
          </p>
        </div>

        {/* El teléfono con las tarjetas flotando alrededor. Van sobre la
            parte vacía del encabezado y debajo del chat: nunca tapan un mensaje. */}
        <div className="relative mx-auto pb-6 pr-10 xl:mx-0">
          <Telefono />
          <div className="login-flota absolute -right-4 -top-6 flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/95 px-3.5 py-2.5 shadow-lift backdrop-blur">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-tint text-primary">
              <Bell className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <p className="text-[12px] font-bold text-ink">Pedido #12 nuevo</p>
              <p className="text-[11px] text-ink-mid">$33.000 · Tocá Aprobar</p>
            </div>
          </div>
          <div
            className="login-flota absolute -left-12 bottom-0 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/95 px-3.5 py-2.5 shadow-lift backdrop-blur"
            style={{ animationDelay: "1.5s" }}
          >
            <BadgeCheck className="h-5 w-5 text-success" />
            <p className="text-[12px] font-bold text-ink">Pago verificado</p>
          </div>
        </div>
      </div>

      <ul className="relative grid max-w-xl grid-cols-3 gap-3">
        {BENEFICIOS.map(({ icono: Icono, titulo, texto }) => (
          <li key={titulo} className="rounded-2xl border border-white/10 bg-white/[.04] p-3.5">
            <Icono className="h-4 w-4 text-primary-light" />
            <p className="mt-2 text-sm font-bold text-white">{titulo}</p>
            <p className="text-xs text-white/60">{texto}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
