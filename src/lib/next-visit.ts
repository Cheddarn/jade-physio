import { addDays, longDate } from "./format";
import type { TherapyReport } from "./types";

/* The next visit: a date, and a note ("3 hari lagi, evaluasi ROM"). Same file in both apps. */

/** The quick picks under "Rencana kunjungan berikutnya", and how many days after the session each one is. */
export const NEXT_VISIT: [label: string, days: number | null][] = [
  ["2 hari lagi", 2],
  ["3 hari lagi", 3],
  ["1 minggu lagi", 7],
  ["2 minggu lagi", 14],
  ["Tidak perlu kontrol", null],
];

/** The date a quick pick points to, counted from the session day; null for none, undefined for text it doesn't know. */
export function nextVisitDateFor(note: string | undefined, sessionDay: string): string | null | undefined {
  const hit = NEXT_VISIT.find(([label]) => note?.trim().toLowerCase() === label.toLowerCase());
  if (!hit) return undefined;
  return hit[1] == null ? null : addDays(sessionDay, hit[1]);
}

/** One line for messages and lists: "Kamis, 21 November 2026 (3 hari lagi)", or the note alone. */
export function nextVisitText(r: Pick<TherapyReport, "nextVisit" | "nextVisitDate">) {
  const note = r.nextVisit?.trim() ?? "";
  if (!r.nextVisitDate) return note;
  const day = longDate(r.nextVisitDate);
  return note ? `${day} (${note})` : day;
}
