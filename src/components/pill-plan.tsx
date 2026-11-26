/**
 * T-127: la etiqueta del plan de un negocio (back office). Un color por plan
 * para distinguirlos de un vistazo en la lista.
 */

import { Pill } from "@/components/ui";
import { NOMBRE_PLAN, type PlanId } from "@/core/planes";

const TONO_PLAN = { plus: "neutral", pro: "info", premium: "success" } as const;

export function PillPlan({ plan }: { plan: PlanId }) {
  return <Pill tone={TONO_PLAN[plan]}>{NOMBRE_PLAN[plan]}</Pill>;
}
