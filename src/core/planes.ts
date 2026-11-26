/**
 * T-127: los planes comerciales del asistente.
 *
 * Tres planes, de menor a mayor: Plus < Pro < Premium. Cada plan incluye
 * todo lo del plan de abajo, así que una función se declara UNA vez, en el
 * plan más bajo que la trae, y `puede()` la hereda hacia arriba.
 *
 * Todavía no se decidió qué función va en cada plan: las listas de
 * `FUNCIONES_POR_PLAN` están vacías a propósito. Cuando se decida, se agrega
 * el nombre de la función en `FUNCIONES` y en el plan que corresponda; el
 * resto del código pregunta con `puede(plan, "wompi")` y no cambia.
 *
 * El plan de un negocio vive en la columna `negocios.plan` (migración 0032),
 * NO en el `config` JSONB: la dueña puede escribir su propia fila, y un
 * trigger de la base solo deja cambiar esa columna al admin.
 */

/** Ids de los planes, en orden de menor a mayor. */
export const PLANES = ["plus", "pro", "premium"] as const;

export type PlanId = (typeof PLANES)[number];

/** Con qué plan nace un negocio y en cuál queda cualquier valor desconocido. */
export const PLAN_POR_DEFECTO: PlanId = "plus";

/** Nombre que se muestra en el back office y en el portal. */
export const NOMBRE_PLAN: Record<PlanId, string> = {
  plus: "Plus",
  pro: "Pro",
  premium: "Premium",
};

/**
 * Funciones que se pueden limitar por plan. Vacía hasta que se decida qué
 * lleva cada plan: con la lista vacía, `Funcion` no admite ningún valor y el
 * compilador impide usar `puede()` con un nombre inventado.
 */
export const FUNCIONES = [] as const;

export type Funcion = (typeof FUNCIONES)[number];

/** La función aparece en el plan más BAJO que la incluye; los de arriba la heredan. */
export const FUNCIONES_POR_PLAN: Record<PlanId, readonly Funcion[]> = {
  plus: [],
  pro: [],
  premium: [],
};

/**
 * Lee un plan que viene de afuera (la columna de la base, un formulario).
 * Cualquier cosa que no sea uno de los tres planes ("free", vacío, null) cae
 * en el plan por defecto en vez de romper: un valor raro nunca debe dejar a
 * un negocio sin asistente.
 */
export function planDe(valor: unknown): PlanId {
  return typeof valor === "string" && (PLANES as readonly string[]).includes(valor)
    ? (valor as PlanId)
    : PLAN_POR_DEFECTO;
}

/** Posición del plan (0 = Plus). Sirve para comparar "este plan o uno mayor". */
export function nivelPlan(plan: PlanId): number {
  return PLANES.indexOf(plan);
}

/** `true` si `plan` es igual o mayor que `minimo`. */
export function planAlcanza(plan: PlanId, minimo: PlanId): boolean {
  return nivelPlan(plan) >= nivelPlan(minimo);
}

/** ¿El plan incluye esta función? Mira su plan y todos los de abajo. */
export function puede(plan: PlanId, funcion: Funcion): boolean {
  return PLANES.slice(0, nivelPlan(plan) + 1).some((p) => FUNCIONES_POR_PLAN[p].includes(funcion));
}

/** El plan más bajo que trae la función, o `null` si ninguno (para decir "Disponible en Pro"). */
export function planMinimoPara(funcion: Funcion): PlanId | null {
  return PLANES.find((p) => FUNCIONES_POR_PLAN[p].includes(funcion)) ?? null;
}
