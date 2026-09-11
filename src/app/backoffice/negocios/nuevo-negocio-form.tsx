"use client";

/**
 * Back office · Form "Nuevo negocio" (14-modal-nuevo-negocio.png, recreado
 * como card inline — mismo patrón que "Nueva plantilla" en /backoffice/rubros
 * y "Invitar usuario" en /backoffice/usuarios, no un modal-overlay nuevo).
 *
 * El bloque "Campos que hereda este negocio" es la única parte que necesita
 * estado en cliente: se recalcula al cambiar de rubro, sin ida y vuelta al
 * servidor.
 */

import { useState } from "react";
import { crearNegocio } from "@/app/backoffice/actions";
import { ActionForm } from "@/components/action-form";
import { Segmented } from "@/components/ui";

const labelCls = "mb-1.5 block text-sm font-semibold text-ink";
const inputCls =
  "input-nexo w-full px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft";

export interface RubroOption {
  id: string;
  nombre: string;
  /** Chips ya calculados server-side con `camposDelNegocio()` (evita repetir Zod en el cliente). */
  campos: string[];
}

export interface ClienteOption {
  id: string;
  email: string;
}

export function NuevoNegocioForm({
  rubros,
  clientes,
}: {
  rubros: RubroOption[];
  clientes: ClienteOption[];
}) {
  const [rubroId, setRubroId] = useState(rubros[0]?.id ?? "");
  const [plan, setPlan] = useState<"free" | "pro">("free");

  const rubroSeleccionado = rubros.find((r) => r.id === rubroId);

  return (
    <ActionForm action={crearNegocio} submitLabel="Crear negocio">
      <input type="hidden" name="plan" value={plan} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Nombre del negocio</label>
          <input
            name="nombre"
            required
            className={inputCls}
            placeholder="Estética Bella"
          />
        </div>
        <div>
          <label className={labelCls}>Slug (identificador, kebab-case)</label>
          <input
            name="slug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            className={inputCls}
            placeholder="estetica-bella"
          />
        </div>

        <div>
          <label className={labelCls}>Cliente dueño</label>
          {clientes.length === 0 ? (
            <p className="rounded-[10px] bg-warn-bg px-3 py-2 text-xs text-warn-ink">
              No hay ningún cliente todavía — invitá uno en Usuarios.
            </p>
          ) : (
            <select name="owner_id" required className={inputCls} defaultValue="">
              <option value="" disabled>
                Elegí un cliente…
              </option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.email}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className={labelCls}>Rubro (plantilla base)</label>
          {rubros.length === 0 ? (
            <p className="rounded-[10px] bg-warn-bg px-3 py-2 text-xs text-warn-ink">
              No hay ningún rubro todavía — creá uno en Rubros.
            </p>
          ) : (
            <select
              name="rubro_id"
              required
              className={inputCls}
              value={rubroId}
              onChange={(e) => setRubroId(e.target.value)}
            >
              {rubros.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className={labelCls}>WhatsApp (opcional)</label>
          <input
            name="whatsapp_phone_number_id"
            className={inputCls}
            placeholder="phone_number_id de Meta"
          />
        </div>
        <div>
          <label className={labelCls}>Plan</label>
          <Segmented
            options={[
              { value: "free", label: "Free" },
              { value: "pro", label: "Pro" },
            ]}
            value={plan}
            onChange={setPlan}
          />
        </div>
      </div>

      {rubroSeleccionado && (
        <div className="rounded-[10px] bg-primary-tint p-3">
          <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-primary">
            Campos que hereda este negocio
          </p>
          <div className="flex flex-wrap gap-1.5">
            {rubroSeleccionado.campos.map((campo) => (
              <span
                key={campo}
                className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-ink-mid"
              >
                {campo}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-ink-soft">
        El negocio nace en pausa; lo activás desde su detalle cuando esté listo.
      </p>
    </ActionForm>
  );
}
