export const INSTITUTE_TIME_ZONE = "Asia/Kolkata";

/** Calendar parts of `date` as seen in India, regardless of the server or browser time zone. */
export function kolkataParts(date: Date = new Date()): { year: number; month: number; day: number; hour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: INSTITUTE_TIME_ZONE, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", hourCycle: "h23" })
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)]),
  );
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour };
}

/**
 * Academic year label for a date, e.g. "2026–27". Years start in `startMonth`
 * (1 = January; MSBTE institutes start in June, so the default is 6).
 */
export function academicYearLabel(date: Date = new Date(), startMonth = 6, separator = "–"): string {
  const { year, month } = kolkataParts(date);
  const start = month >= startMonth ? year : year - 1;
  return `${start}${separator}${String(start + 1).slice(-2)}`;
}
