"use client";

/**
 * Chat público de demostración: el PhonePreview compartido con mensajes
 * reales del bot (via /api/dev/simulate). Cada visita usa un contacto
 * aleatorio (sessionStorage) para no cruzar conversaciones.
 */

import { useState } from "react";
import { Send } from "lucide-react";
import { PhonePreview, type PreviewMessage } from "@/components/phone-preview";

function getVisitorId(): string {
  const key = "demo-visitor-id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `demo-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

export function DemoChat({ businessSlug }: { businessSlug: string }) {
  const [messages, setMessages] = useState<PreviewMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

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
      const data = (await res.json()) as { replies: { text: string }[] };
      setMessages((prev) => [
        ...prev,
        ...data.replies.map((r) => ({ role: "out" as const, text: r.text })),
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
  );
}
