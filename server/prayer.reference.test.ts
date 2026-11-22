import { describe, expect, it } from "vitest";
import { cityDate, hijriDate, prayerTimes } from "../shared/prayer";

describe("Cairo prayer reference", () => {
  it("matches the Egyptian Survey Authority daily table within one minute", () => {
    // https://www.esa.gov.eg/praytimes.aspx — القاهرة، 2026-11-21
    const reference = { fajr: 294, sunrise: 385, dhuhr: 701, asr: 876, maghrib: 1016, isha: 1097 };
    const result = prayerTimes({ lat: 30.0444, lng: 31.2357, tz: "Africa/Cairo" }, new Date("2026-11-21T10:00:00+02:00"));
    for (const key of Object.keys(reference) as (keyof typeof reference)[]) {
      expect(Math.abs(Math.round(result.times[key] * 60) - reference[key]), key).toBeLessThanOrEqual(1);
    }
  });

  it("applies the Hijri offset to the city date across month boundaries", () => {
    const date = new Date("2026-11-01T00:30:00+02:00");
    expect(cityDate("Africa/Cairo", hijriDate(date, "Africa/Cairo", -1))).toMatchObject({ m: 10, d: 31 });
    expect(cityDate("Africa/Cairo", hijriDate(date, "Africa/Cairo", 1))).toMatchObject({ m: 11, d: 2 });
  });
});
