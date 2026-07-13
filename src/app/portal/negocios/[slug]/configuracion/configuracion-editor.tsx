"use client";

/**
 * Editor de Configuración: datos del negocio + persona del bot (nombre y tono
 * con presets Cercano/Neutral/Formal).
 */

import { useActionState, useState } from "react";
import type { BusinessConfig, PersonaConfig } from "@/core/types";
import {
  actualizarWhatsapp,
  guardarConfigParcial,
  type ActionState,
} from "@/app/portal/actions";
import { ActionForm } from "@/components/action-form";
import { Card, Pill, Segmented } from "@/components/ui";

const labelCls = "mb-1.5 block text-sm font-semibold text-ink";
const inputCls =
  "input-nexo w-full px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft";

type Tono = "cercano" | "neutral" | "formal";

const TONOS: Record<Tono, string> = {
  cercano:
    "Cálido y cercano. Usa emojis con moderación, tutea al cliente y responde con energía positiva.",
  neutral:
    "Claro y profesional. Directo al punto, sin emojis, amable pero conciso.",
  formal:
    "Formal y respetuoso. Trata al cliente de usted, lenguaje cuidado y sin emojis.",
};

function tonoActual(tone: string): Tono {
  if (/formal|usted/i.test(tone)) return "formal";
  if (/claro y profesional|neutral|conciso/i.test(tone)) return "neutral";
  return "cercano";
}

export function ConfiguracionEditor({
  slug,
  nombre,
  rubro,
  whatsappId,
  direccion: direccionInicial,
  persona,
  personas,
}: {
  slug: string;
  nombre: string;
  rubro: string;
  whatsappId: string;
  direccion: string;
  persona: PersonaConfig;
  personas: BusinessConfig["personas"];
}) {
  const [direccion, setDireccion] = useState(direccionInicial);
  const [botName, setBotName] = useState(persona.name);
  const [tono, setTono] = useState<Tono>(tonoActual(persona.tone));
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    guardarConfigParcial,
    {},
  );

  const patch = {
    direccion: direccion || undefined,
    personas: {
      ...personas,
      whatsapp: { ...persona, name: botName || "Asistente", tone: TONOS[tono] },
    },
  };

  return (
    <div className="mx-auto max-w-[720px] space-y-4 fade-up">
      {/* Datos del negocio */}
      <Card title="Datos del negocio">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Nombre</label>
            <input
              className={`${inputCls} bg-surface-3 text-ink-mid`}
              value={nombre}
              readOnly
            />
          </div>
          <div>
            <label className={labelCls}>Rubro</label>
            <div className="pt-1.5">
              <Pill tone="info">{rubro}</Pill>
            </div>
          </div>
          <div>
            <label className={labelCls}>Dirección</label>
            <input
              className={inputCls}
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="San Martín 480, Centro"
            />
          </div>
        </div>
      </Card>

      {/* WhatsApp conectado (action propia: columna, no config) */}
      <Card
        title="WhatsApp conectado"
        subtitle="Phone number ID del número en Meta (docs/05-whatsapp-setup.md)."
      >
        <ActionForm action={actualizarWhatsapp} submitLabel="Guardar conexión">
          <input type="hidden" name="slug" value={slug} />
          <div className="relative max-w-sm">
            {whatsappId && (
              <span className="pointer-events-none absolute left-3.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-success" />
            )}
            <input
              name="whatsapp_phone_number_id"
              defaultValue={whatsappId}
              className={`${inputCls} ${whatsappId ? "border-success bg-success-bg pl-8" : ""}`}
              placeholder="123456789012345"
            />
          </div>
        </ActionForm>
      </Card>

      {/* El bot */}
      <Card title="El bot">
        <div className="space-y-4">
          <div className="max-w-sm">
            <label className={labelCls}>Nombre del bot</label>
            <input
              className={inputCls}
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="Asistente"
            />
          </div>
          <div>
            <label className={labelCls}>Tono de las respuestas</label>
            <Segmented<Tono>
              options={[
                { value: "cercano", label: "Cercano" },
                { value: "neutral", label: "Neutral" },
                { value: "formal", label: "Formal" },
              ]}
              value={tono}
              onChange={setTono}
              className="max-w-sm"
            />
            <p className="mt-2 text-xs text-ink-soft">{TONOS[tono]}</p>
          </div>
        </div>
      </Card>

      {/* Guardar */}
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="patch" value={JSON.stringify(patch)} />
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
  );
}
