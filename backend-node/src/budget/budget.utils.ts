/**
 * Helpers shared by budget services — date string math, month ranges,
 * tag resolution. All date values live as `"YYYY-MM-DD"` strings on the wire
 * and in the DB (see Prisma schema: `Transaction.date` is VARCHAR(10)).
 */

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

export function daysInMonth(year: number, month1: number): number {
  // month1 is 1-based. Using JS Date(year, month1, 0) returns last day of month1.
  return new Date(year, month1, 0).getDate();
}

export function monthRange0(
  year: number,
  month0: number,
): {
  start: string;
  end: string;
  daysTotal: number;
} {
  const month1 = month0 + 1;
  const last = daysInMonth(year, month1);
  return {
    start: `${pad4(year)}-${pad2(month1)}-01`,
    end: `${pad4(year)}-${pad2(month1)}-${pad2(last)}`,
    daysTotal: last,
  };
}

export function prevMonth0(year: number, month0: number): [number, number] {
  if (month0 === 0) return [year - 1, 11];
  return [year, month0 - 1];
}

export function todayIsoDate(now: Date = new Date()): string {
  return `${pad4(now.getFullYear())}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function tagIdsFromCsv(input: string | string[] | undefined): number[] {
  if (input === undefined) return [];
  const raw = Array.isArray(input) ? input : input.split(',');
  const out: number[] = [];
  for (const v of raw) {
    const s = String(v).trim();
    if (!s) continue;
    const n = Number(s);
    if (Number.isInteger(n)) out.push(n);
  }
  return out;
}
