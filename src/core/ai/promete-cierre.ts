/**
 * T-115: ¿el texto de la IA da el pedido por hecho? ("está listo para
 * recoger", "ya quedó confirmado", "va en camino"). Mientras el cliente no
 * confirme y la dueña no apruebe, eso es falso: el cliente lee que ya está y
 * no contesta el "¿Confirma su pedido?" que viene debajo. En la prueba real
 * pasó exactamente así.
 *
 * Lista de frases y no el prompt: igual que con los precios (T-98), no se
 * confía en que el modelo obedezca. Una pregunta ("¿Le confirmamos…?") no
 * cuenta: es lo que se quiere que haga.
 */

const PROMESAS = [
  /\blisto para (recoger|retirar|entregar|enviar|despachar)\b/,
  /\b(ya )?(esta|quedo|queda) (listo|lista|confirmad[oa]|registrad[oa]|agendad[oa]|aprobad[oa])\b/,
  /\b(ya )?(se lo|se la|lo|la) (enviamos|despachamos|mandamos|estamos preparando|preparamos)\b/,
  /\b(va|esta|sale) en camino\b/,
  /\bya esta con la duena\b/,
];

export function prometeCierre(texto: string): boolean {
  const t = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  // Las preguntas se sacan antes de buscar: "¿Le confirmamos…?" no promete nada.
  const afirmaciones = t.replace(/¿[^?]*\?/g, " ");
  return PROMESAS.some((r) => r.test(afirmaciones));
}
