import { afterEach, describe, expect, it } from "vitest";
import { createCalendarApi } from "@/core/storage/adapters/google/calendar";

describe("createCalendarApi", () => {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;

  afterEach(() => {
    if (email === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    else process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = email;
    if (key === undefined) delete process.env.GOOGLE_PRIVATE_KEY;
    else process.env.GOOGLE_PRIVATE_KEY = key;
  });

  it("devuelve null cuando no se pasa calendarId", () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "svc@acme.iam.gserviceaccount.com";
    process.env.GOOGLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nx\\n-----END PRIVATE KEY-----";
    expect(createCalendarApi(undefined)).toBeNull();
  });

  it("devuelve null cuando no hay credenciales de service account", () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;
    // calendarId único para no chocar con el cache de otros tests
    expect(createCalendarApi("cal-sin-creds@group.calendar.google.com")).toBeNull();
  });
});
