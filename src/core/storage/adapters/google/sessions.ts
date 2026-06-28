/**
 * Adaptador de sesiones sobre Google Sheets.
 *
 * Espejo de `SessionJsonRepository` (adapters/session-json.ts) pero en una
 * pestaña "Sesiones". Una fila por contacto; el historial reciente (máx. 10
 * turnos) se guarda serializado en JSON en una celda. Así, cuando el cliente
 * vuelve a escribir, la IA recupera el contexto de tono de la conversación.
 */

import type { Channel, ConversationTurn, SessionMemory } from "@/core/types";
import type { SessionRepository } from "@/core/storage/session-repository";
import type { SheetsApi } from "@/core/storage/adapters/google/auth";

const TAB = "Sesiones";
const LAST_COL = "E"; // 5 columnas

/** Máximo de turnos que se conservan (igual que los otros adaptadores). */
const MAX_HISTORY = 10;

const HEADERS = [
  "businessSlug",
  "contact",
  "channel",
  "updatedAt",
  "history",
] as const;

function parseHistory(raw: string): ConversationTurn[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? (parsed as ConversationTurn[]) : [];
  } catch {
    return [];
  }
}

export class GoogleSheetsSessionRepository implements SessionRepository {
  private ready?: Promise<void>;

  constructor(private readonly sheets: SheetsApi) {}

  private ensure(): Promise<void> {
    this.ready ??= this.sheets.ensureSheet(TAB, [...HEADERS]);
    return this.ready;
  }

  /** Busca la fila (1-based, sin contar encabezado) de un contacto. */
  private async findRow(
    businessSlug: string,
    contact: string,
  ): Promise<{ rowNumber: number; row: string[] } | null> {
    await this.ensure();
    const rows = await this.sheets.getValues(`${TAB}!A2:${LAST_COL}`);
    const index = rows.findIndex((r) => r[0] === businessSlug && r[1] === contact);
    if (index < 0) return null;
    return { rowNumber: index + 2, row: rows[index] };
  }

  async getOrCreate(
    businessSlug: string,
    contact: string,
    channel: Channel,
  ): Promise<SessionMemory> {
    const found = await this.findRow(businessSlug, contact);
    if (!found) {
      return {
        contact,
        businessSlug,
        channel,
        history: [],
        updatedAt: new Date().toISOString(),
      };
    }
    const r = found.row;
    return {
      businessSlug: r[0] ?? businessSlug,
      contact: r[1] ?? contact,
      channel: (r[2] as Channel) || channel,
      updatedAt: r[3] ?? new Date().toISOString(),
      history: parseHistory(r[4] ?? ""),
    };
  }

  async save(session: SessionMemory): Promise<void> {
    await this.ensure();
    const trimmed: SessionMemory = {
      ...session,
      history: session.history.slice(-MAX_HISTORY),
      updatedAt: new Date().toISOString(),
    };
    const row = [
      trimmed.businessSlug,
      trimmed.contact,
      trimmed.channel,
      trimmed.updatedAt,
      JSON.stringify(trimmed.history),
    ];
    const found = await this.findRow(session.businessSlug, session.contact);
    if (found) {
      await this.sheets.updateValues(
        `${TAB}!A${found.rowNumber}:${LAST_COL}${found.rowNumber}`,
        [row],
      );
    } else {
      await this.sheets.appendValues(`${TAB}!A2:${LAST_COL}`, [row]);
    }
  }
}
