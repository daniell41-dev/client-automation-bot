"use client";

/**
 * Editor de Respuestas y flujos: IA (knowledge) + reglas rápidas + botones de
 * menú + fallback/derivación. El preview muestra cómo responde el bot con la
 * info y las reglas actuales (se actualiza al tipear).
 */

import { useActionState, useState } from "react";
import { Plus, Sparkles, X } from "lucide-react";
import type { BotAIConfig, MessageTemplates, QuickRule } from "@/core/types";
import { guardarConfigParcial, type ActionState } from "@/app/portal/actions";
import { Card, Toggle } from "@/components/ui";
import { PhonePreview, type PreviewMessage } from "@/components/phone-preview";

const inputCls =
  "input-nexo w-full px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft";

export function RespuestasEditor({
  slug,
  initialAi,
  messages,
  botName,
  botActivo,
}: {
  slug: string;
  initialAi: BotAIConfig;
  messages: MessageTemplates;
  botName: string;
  botActivo: boolean;
}) {
  const [ai, setAi] = useState<BotAIConfig>({
    ...initialAi,
    reglas: initialAi.reglas ?? [],
    botonesMenu: initialAi.botonesMenu ?? [],
  });
  const [fallback, setFallback] = useState(messages.fallback);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    guardarConfigParcial,
    {},
  );

  const patchRule = (i: number, patch: Partial<QuickRule>) =>
    setAi((prev) => ({
      ...prev,
      reglas: prev.reglas!.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    }));

  const primeraRegla = ai.reglas?.find(
    (r) => r.keywords.some((k) => k.trim()) && r.respuesta.trim(),
  );

  // Preview en vivo: IA → regla → botones de menú.
  const previewMessages: PreviewMessage[] = [
    { role: "in", text: "¿Aceptan tarjeta? ¿Hacen envíos?" },
    {
      role: "out",
      note: ai.enabled ? "Respondido con IA" : "IA apagada · plantilla",
      text: ai.enabled
        ? ai.knowledge?.trim()
          ? resumen(ai.knowledge)
          : "Contame qué necesitás y te ayudo 😊 (agregá información del negocio para respuestas más precisas)"
        : fallback,
    },
  ];
  if (primeraRegla) {
    previewMessages.push(
      { role: "in", text: primeraRegla.keywords[0] },
      {
        role: "out",
        note: `Regla · "${primeraRegla.keywords[0]}"`,
        text: primeraRegla.respuesta,
      },
    );
  }

  return (
    <div className="flex flex-wrap items-start gap-5 fade-up">
      {/* ── Columna de trabajo ── */}
      <div className="min-w-[300px] flex-[1_1_460px] space-y-4 sm:min-w-[420px]">
        {/* Cerebro con IA */}
        <Card
          title="Cerebro con IA"
          subtitle="Entiende lenguaje natural con esta info."
          action={
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary-tint text-primary">
                <Sparkles className="h-4 w-4" />
              </span>
              <Toggle
                checked={ai.enabled}
                onChange={(next) => setAi((prev) => ({ ...prev, enabled: next }))}
                label="IA activada"
              />
            </span>
          }
        >
          <label className="mb-1.5 block text-sm font-semibold text-ink">
            Información del negocio
          </label>
          <textarea
            className={inputCls}
            rows={4}
            value={ai.knowledge ?? ""}
            onChange={(e) => setAi((prev) => ({ ...prev, knowledge: e.target.value }))}
            placeholder="Parrilla en el centro. Especialidad en carnes, empanadas y postres caseros. Aceptamos tarjetas y transferencias. Hacemos envíos en toda la ciudad."
          />
        </Card>

        {/* Reglas rápidas */}
        <Card
          title="Reglas rápidas"
          subtitle="Respuestas exactas por palabra clave. Tienen prioridad sobre la IA."
          action={
            <button
              type="button"
              onClick={() =>
                setAi((prev) => ({
                  ...prev,
                  reglas: [...(prev.reglas ?? []), { keywords: [], respuesta: "" }],
                }))
              }
              className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
            >
              <Plus className="h-4 w-4" />
              Agregar regla
            </button>
          }
        >
          <div className="space-y-3">
            {(ai.reglas ?? []).map((rule, i) => (
              <div key={i} className="rounded-xl border border-line bg-surface-3 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {rule.keywords
                    .filter((k) => k.trim())
                    .map((kw) => (
                      <span
                        key={kw}
                        className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-ink-mid"
                      >
                        {kw}
                      </span>
                    ))}
                  <input
                    className="input-nexo flex-1 min-w-[140px] bg-surface px-2.5 py-1 text-xs"
                    placeholder="palabras clave separadas por coma"
                    value={rule.keywords.join(", ")}
                    onChange={(e) =>
                      patchRule(i, {
                        keywords: e.target.value.split(",").map((k) => k.trim()),
                      })
                    }
                  />
                  <button
                    type="button"
                    aria-label="Quitar regla"
                    onClick={() =>
                      setAi((prev) => ({
                        ...prev,
                        reglas: prev.reglas!.filter((_, j) => j !== i),
                      }))
                    }
                    className="text-ink-soft hover:text-warn-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <input
                  className={inputCls}
                  placeholder="Respuesta exacta del bot"
                  value={rule.respuesta}
                  onChange={(e) => patchRule(i, { respuesta: e.target.value })}
                />
              </div>
            ))}
            {(ai.reglas ?? []).length === 0 && (
              <p className="py-2 text-center text-sm text-ink-soft">
                Sin reglas. Agregá una para responder exacto a &quot;horario&quot;,
                &quot;envío&quot;, etc.
              </p>
            )}
          </div>
        </Card>

        {/* Botones de menú */}
        <Card
          title="Botones de menú"
          subtitle="Accesos rápidos que ve el cliente en el chat."
          action={
            <button
              type="button"
              onClick={() =>
                setAi((prev) => ({
                  ...prev,
                  botonesMenu: [...(prev.botonesMenu ?? []), ""],
                }))
              }
              className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
            >
              <Plus className="h-4 w-4" />
              Agregar
            </button>
          }
        >
          <div className="space-y-2">
            {(ai.botonesMenu ?? []).map((btn, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className={inputCls}
                  value={btn}
                  placeholder="Ver menú"
                  onChange={(e) =>
                    setAi((prev) => ({
                      ...prev,
                      botonesMenu: prev.botonesMenu!.map((b, j) =>
                        j === i ? e.target.value : b,
                      ),
                    }))
                  }
                />
                <button
                  type="button"
                  aria-label="Quitar botón"
                  onClick={() =>
                    setAi((prev) => ({
                      ...prev,
                      botonesMenu: prev.botonesMenu!.filter((_, j) => j !== i),
                    }))
                  }
                  className="text-ink-soft hover:text-warn-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            {(ai.botonesMenu ?? []).length === 0 && (
              <p className="py-2 text-center text-sm text-ink-soft">
                Sin botones configurados.
              </p>
            )}
          </div>
        </Card>

        {/* Fallback */}
        <Card
          title="Si el bot no entiende"
          action={
            <span className="flex items-center gap-2 text-sm text-ink-mid">
              Derivar a una persona
              <Toggle
                checked={Boolean(ai.derivarHumano)}
                onChange={(next) =>
                  setAi((prev) => ({ ...prev, derivarHumano: next }))
                }
              />
            </span>
          }
        >
          <textarea
            className={inputCls}
            rows={2}
            value={fallback}
            onChange={(e) => setFallback(e.target.value)}
          />
        </Card>

        {/* Guardar */}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="slug" value={slug} />
          <input
            type="hidden"
            name="patch"
            value={JSON.stringify({
              ai: {
                ...ai,
                reglas: (ai.reglas ?? [])
                  .map((r) => ({
                    keywords: r.keywords.filter((k) => k.trim()),
                    respuesta: r.respuesta,
                  }))
                  .filter((r) => r.keywords.length > 0 && r.respuesta.trim()),
                botonesMenu: (ai.botonesMenu ?? []).filter((b) => b.trim()),
              },
              messages: { ...messages, fallback },
            })}
          />
          {state.error && (
            <p className="rounded-[10px] bg-warn-bg px-3 py-2 text-sm text-warn-ink">
              {state.error}
            </p>
          )}
          {state.ok && (
            <p className="rounded-[10px] bg-success-bg px-3 py-2 text-sm text-success-ink">
              {state.ok}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-[10px] bg-primary py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:opacity-50 sm:w-auto sm:px-8"
          >
            {pending ? "Guardando…" : "Guardar cambios"}
          </button>
        </form>
      </div>

      {/* ── Preview ── */}
      <PhonePreview
        botName={botName}
        online={botActivo}
        messages={previewMessages}
        quickReplies={(ai.botonesMenu ?? []).filter((b) => b.trim())}
      />
    </div>
  );
}

/** Primer par de frases del knowledge, como respuesta simulada de la IA. */
function resumen(knowledge: string): string {
  const frases = knowledge
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
  return `¡Sí! ${frases}`;
}
