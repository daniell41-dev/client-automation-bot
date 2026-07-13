"use client";

/**
 * Bandeja de conversaciones: lista de chats + hilo activo estilo WhatsApp.
 * Read-only en esta fase: "Tomar chat" queda deshabilitado (próxima fase).
 * En móvil los paneles se apilan: lista → hilo con botón de volver.
 */

import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { EmptyState, Pill, SearchInput } from "@/components/ui";

export interface Chat {
  contact: string;
  updatedAt: string;
  history: { role: "user" | "assistant"; text: string; timestamp?: string }[];
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ConversacionesInbox({
  chats,
  botName,
  botActivo,
}: {
  chats: Chat[];
  botName: string;
  botActivo: boolean;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(
    chats[0]?.contact ?? null,
  );
  // En móvil: false = viendo la lista, true = viendo el hilo.
  const [mobileThread, setMobileThread] = useState(false);

  const visibles = useMemo(
    () =>
      chats.filter(
        (c) =>
          !search.trim() ||
          c.contact.toLowerCase().includes(search.toLowerCase()) ||
          c.history.some((t) =>
            t.text.toLowerCase().includes(search.toLowerCase()),
          ),
      ),
    [chats, search],
  );

  const chat = chats.find((c) => c.contact === selected) ?? null;

  if (chats.length === 0) {
    return (
      <div className="mx-auto max-w-[720px] fade-up">
        <EmptyState
          title="Aún no hay conversaciones."
          subtitle="Cuando tus clientes escriban al bot por WhatsApp, los chats van a aparecer acá."
        />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-160px)] gap-4 fade-up md:h-[calc(100vh-120px)]">
      {/* ── Lista de chats ── */}
      <div
        className={`w-full flex-col rounded-2xl border border-line bg-surface shadow-card md:flex md:w-[300px] ${
          mobileThread ? "hidden" : "flex"
        }`}
      >
        <div className="border-b border-line p-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar chats…" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {visibles.map((c) => {
            const last = c.history[c.history.length - 1];
            return (
              <button
                key={c.contact}
                type="button"
                onClick={() => {
                  setSelected(c.contact);
                  setMobileThread(true);
                }}
                className={`flex w-full items-center gap-2.5 border-b border-line px-3 py-3 text-left transition-colors ${
                  c.contact === selected
                    ? "bg-primary-tint"
                    : "hover:bg-surface-3"
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rubro-servicios-bg text-xs font-bold text-rubro-servicios-ink">
                  {c.contact.slice(-2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold text-ink">
                      {c.contact}
                    </span>
                    <Pill tone={last?.role === "assistant" ? "success" : "info"}>
                      {last?.role === "assistant" ? "Bot" : "Vos"}
                    </Pill>
                  </span>
                  <span className="block truncate text-[13px] text-ink-soft">
                    {last?.text ?? "—"}
                  </span>
                </span>
                <span className="shrink-0 self-start pt-0.5 text-[11px] text-ink-soft">
                  {hora(c.updatedAt)}
                </span>
              </button>
            );
          })}
          {visibles.length === 0 && (
            <p className="p-6 text-center text-sm text-ink-soft">Sin resultados.</p>
          )}
        </div>
      </div>

      {/* ── Hilo activo ── */}
      <div
        className={`min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card md:flex ${
          mobileThread ? "flex" : "hidden"
        }`}
      >
        {chat ? (
          <>
            {/* Header del hilo */}
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <button
                type="button"
                onClick={() => setMobileThread(false)}
                className="text-ink-mid md:hidden"
                aria-label="Volver a la lista"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rubro-servicios-bg text-xs font-bold text-rubro-servicios-ink">
                {chat.contact.slice(-2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-bold text-ink">
                  {chat.contact}
                </span>
                <span className="block text-xs text-success-ink">en línea</span>
              </span>
              <Pill tone={botActivo ? "success" : "warn"} dot>
                {botActivo ? "Bot respondiendo" : "Bot en pausa"}
              </Pill>
              <button
                type="button"
                disabled
                title="Próximamente"
                className="hidden rounded-[10px] border border-line-input px-3 py-1.5 text-sm font-semibold text-ink-mid opacity-60 sm:block"
              >
                Tomar chat
              </button>
            </div>

            {/* Cuerpo estilo WhatsApp */}
            <div className="flex-1 space-y-2 overflow-y-auto bg-wa-bg px-4 py-4">
              <div className="mx-auto w-fit rounded-md bg-wa-today px-2 py-0.5 text-[10px] font-semibold text-ink-mid shadow-card">
                HOY
              </div>
              {chat.history.map((t, i) => (
                <div
                  key={i}
                  className={`flex ${t.role === "assistant" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-snug text-ink shadow-card ${
                      t.role === "assistant"
                        ? "rounded-br-[3px] bg-wa-out"
                        : "rounded-bl-[3px] bg-white"
                    }`}
                  >
                    {t.text}
                    {t.timestamp && (
                      <span className="mt-0.5 block text-right text-[10px] text-ink-soft">
                        {hora(t.timestamp)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Input (deshabilitado: el bot responde) */}
            <div className="flex items-center gap-2 border-t border-line bg-surface-2 px-3 py-2.5">
              <input
                disabled
                placeholder={`${botName} está respondiendo este chat…`}
                className="input-nexo flex-1 bg-white px-3.5 py-2 text-sm opacity-70"
              />
              <button
                type="button"
                disabled
                className="rounded-[10px] bg-primary px-4 py-2 text-sm font-bold text-white opacity-50"
              >
                Enviar
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-ink-soft">
            Elegí un chat para ver la conversación.
          </div>
        )}
      </div>
    </div>
  );
}
