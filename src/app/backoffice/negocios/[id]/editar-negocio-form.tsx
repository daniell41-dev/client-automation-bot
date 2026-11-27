"use client";

/**
 * Back office · Form "Datos del negocio" del detalle (T-12: valida con el
 * mismo Zod que el servidor antes de enviar). Extraído a su propio client
 * component porque `useState` no corre en el server component del detalle.
 */

import { useState } from "react";
import type { FormEvent } from "react";
import { actualizarNegocio } from "@/app/backoffice/actions";
import { actualizarNegocioSchema } from "@/app/backoffice/negocio-schema";
import { NOMBRE_PLAN, PLANES, type PlanId } from "@/core/planes";
import { ActionForm } from "@/components/action-form";
import { textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (backoffice.negocio). */
const tt = textos.backoffice.negocio;

const labelCls = "mb-1.5 block text-sm font-semibold text-ink";
const inputCls =
  "input-nexo w-full px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft";

export interface ClienteOption {
  id: string;
  email: string;
}

export function EditarNegocioForm({
  negocioId,
  nombre,
  ownerId,
  whatsappId,
  plan,
  clientes,
}: {
  negocioId: string;
  nombre: string;
  ownerId: string;
  whatsappId: string;
  plan: PlanId;
  clientes: ClienteOption[];
}) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const result = actualizarNegocioSchema.safeParse(data);
    if (result.success) {
      setFieldErrors({});
      return;
    }
    e.preventDefault();
    const errors: Record<string, string> = {};
    for (const [field, messages] of Object.entries(result.error.flatten().fieldErrors)) {
      if (messages?.[0]) errors[field] = messages[0];
    }
    setFieldErrors(errors);
  };

  return (
    <ActionForm action={actualizarNegocio} submitLabel={tt.guardarCambios} onSubmit={handleSubmit}>
      <input type="hidden" name="id" value={negocioId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>{tt.nombreDelNegocio}</label>
          <input
            name="nombre"
            defaultValue={nombre}
            className={`${inputCls} ${fieldErrors.nombre ? "border-warn-ink" : ""}`}
          />
          {fieldErrors.nombre && (
            <p className="mt-1 text-xs text-warn-ink">{fieldErrors.nombre}</p>
          )}
        </div>
        <div>
          <label className={labelCls}>{tt.clienteDueno}</label>
          <select
            name="owner_id"
            defaultValue={ownerId}
            className={`${inputCls} ${fieldErrors.owner_id ? "border-warn-ink" : ""}`}
          >
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.email}
              </option>
            ))}
          </select>
          {fieldErrors.owner_id && (
            <p className="mt-1 text-xs text-warn-ink">{fieldErrors.owner_id}</p>
          )}
        </div>
        <div>
          <label className={labelCls}>{tt.whatsappPhoneNumberId}</label>
          <input
            name="whatsapp_phone_number_id"
            defaultValue={whatsappId}
            className={inputCls}
            placeholder={tt.sinConectar}
          />
        </div>
        <div>
          <label className={labelCls}>{tt.plan}</label>
          <select name="plan" defaultValue={plan} className={inputCls}>
            {PLANES.map((p) => (
              <option key={p} value={p}>
                {NOMBRE_PLAN[p]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </ActionForm>
  );
}
