/**
 * Utilitaires de dates en fuseau Europe/Paris (bornes de jour, semaine, mois,
 * année) — indispensables pour que « importés cette semaine » ou un filtre
 * « mois » soient justes indépendamment du fuseau du serveur (UTC sur Vercel).
 */
const DEFAULT_TZ = "Europe/Paris";

function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/** Instant UTC correspondant à une date/heure murale dans le fuseau donné. */
export function zonedTimeToUtc(year: number, month: number, day: number, hour = 0, minute = 0, timeZone = DEFAULT_TZ): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offset = offsetMinutes(guess, timeZone);
  const result = new Date(guess.getTime() - offset * 60000);
  // Ajustement autour des changements d'heure
  const offset2 = offsetMinutes(result, timeZone);
  return offset2 === offset ? result : new Date(guess.getTime() - offset2 * 60000);
}

/** Date murale (année, mois, jour, jour de semaine) d'un instant dans le fuseau. */
export function zonedParts(instant: Date, timeZone = DEFAULT_TZ) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekdayIndex: weekdays.indexOf(get("weekday")), // 0 = lundi
  };
}

export function startOfWeek(now = new Date(), timeZone = DEFAULT_TZ): Date {
  const { year, month, day, weekdayIndex } = zonedParts(now, timeZone);
  const monday = new Date(Date.UTC(year, month - 1, day - weekdayIndex));
  return zonedTimeToUtc(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate(), 0, 0, timeZone);
}

export function startOfMonth(now = new Date(), timeZone = DEFAULT_TZ): Date {
  const { year, month } = zonedParts(now, timeZone);
  return zonedTimeToUtc(year, month, 1, 0, 0, timeZone);
}

/** Parse "AAAA-MM-JJ" → [début, fin[ du jour dans le fuseau. */
export function dayRange(value: string, timeZone = DEFAULT_TZ): [Date, Date] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const next = new Date(Date.UTC(y, mo - 1, d + 1));
  return [
    zonedTimeToUtc(y, mo, d, 0, 0, timeZone),
    zonedTimeToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0, timeZone),
  ];
}

/** Parse "AAAA-MM" → [début, fin[ du mois. */
export function monthRange(value: string, timeZone = DEFAULT_TZ): [Date, Date] | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo] = [Number(m[1]), Number(m[2])];
  if (mo < 1 || mo > 12) return null;
  return [zonedTimeToUtc(y, mo, 1, 0, 0, timeZone), zonedTimeToUtc(mo === 12 ? y + 1 : y, mo === 12 ? 1 : mo + 1, 1, 0, 0, timeZone)];
}

/** Parse "AAAA" → [début, fin[ de l'année. */
export function yearRange(value: string, timeZone = DEFAULT_TZ): [Date, Date] | null {
  if (!/^\d{4}$/.test(value)) return null;
  const y = Number(value);
  return [zonedTimeToUtc(y, 1, 1, 0, 0, timeZone), zonedTimeToUtc(y + 1, 1, 1, 0, 0, timeZone)];
}

/** Format "AAAA-MM-JJTHH:mm" (input datetime-local) dans le fuseau donné. */
export function toLocalInputValue(instant: Date, timeZone = DEFAULT_TZ): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Inverse de toLocalInputValue. */
export function fromLocalInputValue(value: string, timeZone = DEFAULT_TZ): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value);
  if (!m) return null;
  return zonedTimeToUtc(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] ?? 12), Number(m[5] ?? 0), timeZone);
}
