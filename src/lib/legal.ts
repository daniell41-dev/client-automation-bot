/**
 * T-70: quién responde por los datos y cómo contactarlo. Un solo lugar para
 * que la política, los términos y la página de borrado digan lo mismo; si
 * cambia el correo o la dirección, se cambia acá.
 */

export const RESPONSABLES = ["Carlos Daniel Valero Guerrero", "Oriana Delimar Mendez Prato"] as const;

export const CONTACTO_LEGAL = {
  direccion: "Av. 7 # 5-68, barrio San Luis, Cúcuta, Norte de Santander, Colombia",
  correo: "daniellvalero41@gmail.com",
  // Un solo teléfono a propósito: el del responsable que atiende las
  // solicitudes. Se deja como lista para que las páginas no cambien si
  // algún día se suma otro.
  telefonos: ["+57 322 683 7610"],
} as const;

/** Fecha que se muestra como "última actualización"; cambiarla al editar los textos. */
export const ACTUALIZADO = "14 de noviembre de 2026";
