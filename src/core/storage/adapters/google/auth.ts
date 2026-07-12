/**
 * Acceso a Google Sheets vía Service Account.
 *
 * Aísla `googleapis` detrás de una interfaz angosta (`SheetsApi`) con solo las
 * operaciones que usan los adaptadores. Así los repositorios de leads/sesiones
 * se testean inyectando un fake, sin red ni credenciales.
 *
 * Credenciales globales (en `.env.local`, NUNCA commiteadas):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  — email de la cuenta de servicio
 *   GOOGLE_PRIVATE_KEY            — clave privada (los `\n` se normalizan)
 *
 * El spreadsheetId es POR NEGOCIO (en BusinessConfig.storage.spreadsheetId).
 * Como fallback se lee GOOGLE_SHEETS_SPREADSHEET_ID del entorno (migración suave).
 *
 * La hoja de cada negocio debe estar compartida con el email de la cuenta de servicio.
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

interface ServiceAccountCreds {
  email: string;
  privateKey: string;
}

interface SheetsConfig extends ServiceAccountCreds {
  spreadsheetId: string;
}

/**
 * Lee las credenciales globales de la service account del entorno.
 * No incluye spreadsheetId — ese es por negocio.
 */
export function serviceAccountFromEnv(): ServiceAccountCreds | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
    ?.replace(/\\n/g, "\n")
    ?.replace(/\r\n/g, "\n")
    ?.replace(/\r/g, "\n")
    ?.replace(/^["']/, "");
  if (!email || !privateKey) return null;
  return { email, privateKey };
}

/**
 * @deprecated Usar serviceAccountFromEnv() + createSheetsApi(spreadsheetId).
 * Se mantiene solo para compatibilidad con scripts que lo llamen directamente.
 */
export function sheetsConfigFromEnv(): (ServiceAccountCreds & { spreadsheetId: string }) | null {
  const creds = serviceAccountFromEnv();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!creds || !spreadsheetId) return null;
  return { ...creds, spreadsheetId };
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

/** Cache por spreadsheetId: un cliente por planilla, compartiendo la service account. */
const cache = new Map<string, SheetsApi | null>();

/**
 * Devuelve un cliente de Sheets para la planilla indicada, o `null` si no hay
 * credenciales de service account configuradas.
 *
 * @param spreadsheetId  ID de la planilla del negocio. Si se omite, cae al
 *                       GOOGLE_SHEETS_SPREADSHEET_ID global (compatibilidad).
 */
export function createSheetsApi(spreadsheetId?: string): SheetsApi | null {
  const id = spreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!id) return null;

  if (cache.has(id)) return cache.get(id)!;

  const creds = serviceAccountFromEnv();
  const instance = creds ? new GoogleSheetsApi({ ...creds, spreadsheetId: id }) : null;
  cache.set(id, instance);
  return instance;
}
