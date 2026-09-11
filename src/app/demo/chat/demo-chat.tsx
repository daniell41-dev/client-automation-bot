"use client";

/**
 * Chat público de demostración: el PhonePreview compartido con mensajes
 * reales del bot (via /api/dev/simulate). Cada visita usa un contacto
 * aleatorio (sessionStorage) para no cruzar conversaciones.
 */

import { useState } from "react";
import { RotateCcw, Send } from "lucide-react";
import { PhonePreview, type PreviewMessage } from "@/components/phone-preview";

const VISITOR_KEY = "demo-visitor-id";

function nuevoVisitorId(): string {
  return `demo-${Math.random().toString(36).slice(2, 10)}`;
}

function getVisitorId(): string {
  let id = sessionStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = nuevoVisitorId();
    sessionStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

export function DemoChat({ businessSlug }: { businessSlug: string }) {
  const [messages, setMessages] = useState<PreviewMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  /**
   * Arranca una conversación nueva: el id de visitante identifica al "cliente"
   * en la base, así que hay que cambiarlo para que el bot no siga viendo el
   * nombre/servicio/fecha de la prueba anterior.
   */
  function reiniciar() {
    sessionStorage.setItem(VISITOR_KEY, nuevoVisitorId());
    setMessages([]);
    setInput("");
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "in", text }]);
    setSending(true);

    try {
      const res = await fetch("/api/dev/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          business: businessSlug,
          from: getVisitorId(),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as {
        replies: { text: string }[];
        _debug?: { modo?: "agente" | "guiado"; motivoFallback?: string };
      };
      // El chip solo importa cuando algo falló (guiado = el agente no pudo
      // procesar este turno) o en desarrollo, donde vale la pena ver siempre
      // quién respondió — en producción, si todo va bien, no aporta nada.
      const { modo, motivoFallback } = data._debug ?? {};
      const mostrarModo = process.env.NODE_ENV !== "production" || modo === "guiado";
      const note =
        mostrarModo && modo
          ? modo === "guiado" && motivoFallback
            ? `⚠️ guiado (fallback): ${motivoFallback}`
            : modo
          : undefined;
      setMessages((prev) => [
        ...prev,
        ...data.replies.map((r) => ({ role: "out" as const, text: r.text, note })),
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "out", text: "⚠️ No pude responder; intentá de nuevo." },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <PhonePreview
      botName="Isabella"
      messages={
        messages.length > 0
          ? messages
          : [{ role: "out", text: 'Escribí "Hola" para empezar 👋' }]
      }
      className="min-h-[540px] w-[320px]"
      footer={
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex items-center gap-2 bg-surface-2 px-2.5 py-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={sending ? "El bot está escribiendo…" : "Escribí un mensaje…"}
            className="flex-1 rounded-full bg-white px-3.5 py-2 text-[13px] text-ink outline-none placeholder:text-ink-soft"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label="Enviar"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-wa-header text-white disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      }
      />

      <button
        type="button"
        onClick={reiniciar}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-mid hover:text-ink"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Empezar una conversación nueva
      </button>
      <p className="max-w-[320px] text-center text-xs text-ink-soft">
        El bot recuerda tu nombre y tu cita entre mensajes. Usá este botón para
        probar desde cero, como un cliente que escribe por primera vez.
      </p>
    </div>
  );
}
