/**
 * Acceso a Google Sheets vía Service Account.
 *
 * Aísla `googleapis` detrás de una interfaz angosta (`SheetsApi`) con solo las
 * operaciones que usan los adaptadores. Así los repositorios de leads/sesiones
 * se testean inyectando un fake, sin red ni credenciales.
 *
 * Credenciales (en `.env.local`, NUNCA commiteadas):
 *   GOOGLE_SHEETS_SPREADSHEET_ID  — id de la hoja de cálculo
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  — email de la cuenta de servicio
 *   GOOGLE_PRIVATE_KEY            — clave privada (los `\n` se normalizan)
 *
 * La hoja debe estar compartida con el email de la cuenta de servicio.
 */

import { google } from "googleapis";

/** Operaciones mínimas sobre una hoja que necesitan los adaptadores. */
export interface SheetsApi {
  /** Lee un rango (p. ej. "Leads!A2:N"); devuelve filas como matriz de strings. */
  getValues(range: string): Promise<string[][]>;
  /** Escribe valores en un rango exacto (sobrescribe). */
  updateValues(range: string, values: string[][]): Promise<void>;
  /** Agrega filas al final de la pestaña. */
  appendValues(range: string, values: string[][]): Promise<void>;
  /** Crea la pestaña y su fila de encabezados si no existen (idempotente). */
  ensureSheet(title: string, headers: string[]): Promise<void>;
}

interface SheetsConfig {
  spreadsheetId: string;
  email: string;
  privateKey: string;
}

/** Lee la config de Sheets del entorno, o `null` si falta algo. */
export function sheetsConfigFromEnv(): SheetsConfig | null {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
    ?.replace(/\\n/g, "\n")  // literal \n → LF (loadEnvLocal no convierte)
    ?.replace(/\r\n/g, "\n") // CRLF → LF (Windows)
    ?.replace(/\r/g, "\n")   // CR suelto → LF
    ?.replace(/^["']/, "");  // dotenv deja comilla inicial si no hay cierre matching
  if (!spreadsheetId || !email || !privateKey) return null;
  return { spreadsheetId, email, privateKey };
}

/** Implementación real sobre la API de Google Sheets. */
class GoogleSheetsApi implements SheetsApi {
  private readonly sheets;

  constructor(private readonly config: SheetsConfig) {
    const auth = new google.auth.JWT({
      email: config.email,
      key: config.privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    this.sheets = google.sheets({ version: "v4", auth });
  }

  async getValues(range: string): Promise<string[][]> {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.config.spreadsheetId,
      range,
    });
    return (res.data.values as string[][] | undefined) ?? [];
  }

  async updateValues(range: string, values: string[][]): Promise<void> {
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.config.spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values },
    });
  }

  async appendValues(range: string, values: string[][]): Promise<void> {
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.config.spreadsheetId,
      range,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
  }

  async ensureSheet(title: string, headers: string[]): Promise<void> {
    const meta = await this.sheets.spreadsheets.get({
      spreadsheetId: this.config.spreadsheetId,
    });
    const exists = meta.data.sheets?.some(
      (s) => s.properties?.title === title,
    );
    if (!exists) {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.config.spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title } } }],
        },
      });
    }
    // Escribe los encabezados solo si la fila 1 está vacía (no pisa datos).
    const firstRow = await this.getValues(`${title}!1:1`);
    if (firstRow.length === 0 || firstRow[0]?.length === 0) {
      await this.updateValues(`${title}!A1`, [headers]);
    }
  }
}

/** Cache del cliente (la config no cambia en runtime). */
let cached: SheetsApi | null | undefined;

/**
 * Devuelve un cliente de Sheets autenticado, o `null` si no hay credenciales
 * configuradas (el sistema cae entonces a los adaptadores JSON).
 */
export function createSheetsApi(): SheetsApi | null {
  if (cached !== undefined) return cached;
  const config = sheetsConfigFromEnv();
  cached = config ? new GoogleSheetsApi(config) : null;
  return cached;
}
