"use client";

/**
 * Chat de demostración: burbujas cliente/bot contra /api/dev/simulate.
 * Cada visita usa un contacto aleatorio (sessionStorage) para no cruzar
 * conversaciones entre visitantes.
 */

import { useEffect, useRef, useState } from "react";

interface Bubble {
  role: "user" | "bot";
  text: string;
}

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
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bubbles]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setBubbles((b) => [...b, { role: "user", text }]);
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
      setBubbles((b) => [
        ...b,
        ...data.replies.map((r) => ({ role: "bot" as const, text: r.text })),
      ]);
    } catch {
      setBubbles((b) => [
        ...b,
        { role: "bot", text: "⚠️ No pude responder; intenta de nuevo." },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col rounded-xl border border-slate-200 bg-white">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {bubbles.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">
            Escribe &quot;Hola&quot; para empezar 👋
          </p>
        )}
        {bubbles.map((bubble, i) => (
          <div
            key={i}
            className={bubble.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                bubble.role === "user"
                  ? "max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-green-600 px-4 py-2 text-sm text-white"
                  : "max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2 text-sm text-slate-800"
              }
            >
              {bubble.text}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-400">
              escribiendo…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex gap-2 border-t border-slate-200 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe un mensaje…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
