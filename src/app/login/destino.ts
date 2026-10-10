/**
 * Destino seguro después del login (T-35).
 *
 * `?next=` viene en la URL, así que cualquiera puede armar un link de login
 * con el destino que quiera. Una ruta que empieza con "//" (o "/\", que los
 * navegadores tratan igual) no es una ruta de la app: el navegador la lee
 * como "otro sitio", y el link de login de Nexo terminaba mandando a la
 * dueña, ya autenticada, a una página falsa. Solo se acepta una ruta
 * interna; si no, se decide por rol como siempre.
 */
export function destinoSeguro(next: string): string | null {
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
