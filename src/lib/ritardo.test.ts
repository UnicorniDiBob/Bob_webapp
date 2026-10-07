import { describe, expect, it } from "vitest";
import { minutiValidi, ritardoPossibile } from "./ritardo";
import {
  busyFromAppointments,
  computeFreeSlotsWithAvailability,
  conChiSiSovrappone,
} from "./slots";

// 7 ottobre 2026, 10:00 a Roma (UTC+2).
const adesso = new Date("2026-10-07T08:00:00.000Z");

const oggi = {
  starts_at: "2026-10-07T08:30:00.000Z",
  duration_minutes: 60,
  status: "confirmed",
  request_id: "r1",
};

describe("il ritardo del pro (116)", () => {
  it("si dichiara su un appuntamento confermato con un cliente di oggi", () => {
    expect(ritardoPossibile(oggi, adesso)).toBe(true);
  });

  it("anche quando e' gia' cominciato, finche' non e' finito", () => {
    expect(ritardoPossibile(oggi, new Date("2026-10-07T09:29:00.000Z"))).toBe(true);
    expect(ritardoPossibile(oggi, new Date("2026-10-07T09:30:00.000Z"))).toBe(false);
  });

  it("non su un altro giorno: il giorno e' quello di Roma, non quello UTC", () => {
    // 23:30 del 6 a Roma = 21:30Z del 6; adesso e' il 7 a Roma.
    expect(
      ritardoPossibile({ ...oggi, starts_at: "2026-10-08T08:30:00.000Z" }, adesso)
    ).toBe(false);
    // 00:30 dell'8 a Roma e' ancora il 7 in UTC: non e' oggi.
    const quasiMezzanotte = new Date("2026-10-07T21:50:00.000Z");
    expect(
      ritardoPossibile({ ...oggi, starts_at: "2026-10-07T22:30:00.000Z" }, quasiMezzanotte)
    ).toBe(false);
  });

  it("non su una proposta, un annullato o una voce privata", () => {
    expect(ritardoPossibile({ ...oggi, status: "proposed" }, adesso)).toBe(false);
    expect(ritardoPossibile({ ...oggi, status: "cancelled" }, adesso)).toBe(false);
    expect(ritardoPossibile({ ...oggi, request_id: null }, adesso)).toBe(false);
  });

  it("i minuti vanno da 1 a 240, interi", () => {
    expect(minutiValidi(1)).toBe(true);
    expect(minutiValidi(240)).toBe(true);
    expect(minutiValidi(0)).toBe(false);
    expect(minutiValidi(241)).toBe(false);
    expect(minutiValidi(12.5)).toBe(false);
  });
});

describe("con chi si sovrappone", () => {
  const righe = [
    { id: "a", starts_at: "2026-10-07T08:00:00.000Z", duration_minutes: 60, status: "confirmed" },
    { id: "b", starts_at: "2026-10-07T09:00:00.000Z", duration_minutes: 30, status: "proposed" },
    { id: "c", starts_at: "2026-10-07T08:30:00.000Z", duration_minutes: 30, status: "cancelled" },
  ];

  it("dice quali, in ordine, senza gli annullati e senza se stesso", () => {
    const x = conChiSiSovrappone(new Date("2026-10-07T08:45:00.000Z"), 30, righe, "z");
    expect(x.map((r) => r.id)).toEqual(["a", "b"]);
    expect(
      conChiSiSovrappone(new Date("2026-10-07T08:45:00.000Z"), 30, righe, "a").map((r) => r.id)
    ).toEqual(["b"]);
  });

  it("toccarsi agli estremi non e' sovrapporsi", () => {
    expect(conChiSiSovrappone(new Date("2026-10-07T09:30:00.000Z"), 30, righe)).toEqual([]);
  });
});

describe("gli orari mostrati al cliente dopo un ritardo", () => {
  it("lo slot raggiunto dall'appuntamento slittato non si offre", () => {
    // Fascia del pro: mercoledi' 8-18. Un appuntamento fra 3 giorni alle
    // 14:00 (60 min) slitta di 45 minuti: finisce alle 15:45 invece delle
    // 15:00. Lo slot delle 15:00 non deve piu' comparire.
    const ora = Date.now();
    const giorno = new Date(ora + 3 * 86_400_000);
    const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(giorno);
    const wd = new Date(`${ymd}T12:00:00Z`).getUTCDay();
    const windows = [{ weekday: wd, start: "08:00", end: "18:00" }];
    // L'ora di Roma di quel giorno, con l'offset giusto (+02:00 o +01:00
    // dopo il cambio d'ora): si confrontano istanti, non stringhe.
    const off = new Intl.DateTimeFormat("en", {
      timeZone: "Europe/Rome",
      timeZoneName: "longOffset",
    })
      .formatToParts(new Date(`${ymd}T12:00:00Z`))
      .find((p) => p.type === "timeZoneName")!
      .value.replace("GMT", "");
    const alle = (hhmm: string) =>
      new Date(`${ymd}T${hhmm}:00${off || "+00:00"}`).toISOString();
    const slittato = [
      { starts_at: alle("14:45"), duration_minutes: 60, status: "confirmed" },
    ];
    const slots = computeFreeSlotsWithAvailability({
      windows,
      busy: busyFromAppointments(slittato),
      durationMinutes: 60,
      days: 5,
    }).map((d) => d.toISOString());
    expect(slots).not.toContain(alle("15:00"));
    expect(slots).not.toContain(alle("14:00"));
    expect(slots).toContain(alle("16:00"));
  });
});
