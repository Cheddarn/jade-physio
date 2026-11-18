import { store } from "./store";
import type { TherapyReport } from "./types";

/*
  Archiving therapy reports by date: an archived report stays readable, printable and in the patient's history and
  progress, but can't be changed until it is restored. Same file in both apps.
*/

export const isArchived = (r: Pick<TherapyReport, "archivedAt"> | null | undefined) => !!r?.archivedAt;

async function each(ids: string[], fn: (id: string) => Promise<void>, onProgress?: (done: number) => void) {
  let done = 0;
  for (let i = 0; i < ids.length; i += 20) {
    await Promise.all(ids.slice(i, i + 20).map(fn));
    done = Math.min(ids.length, i + 20);
    onProgress?.(done);
  }
  return done;
}

export function archiveReports(ids: string[], by: string, onProgress?: (done: number) => void) {
  const at = Date.now();
  return each(ids, (id) => store.update("reports", id, { archivedAt: at, archivedBy: by }), onProgress);
}

export function restoreReports(ids: string[], onProgress?: (done: number) => void) {
  return each(ids, (id) => store.update("reports", id, { archivedAt: null, archivedBy: null }), onProgress);
}

/** First and last day of the month before the one `today` is in, as YYYY-MM-DD. */
export function lastMonth(today: string): [string, string] {
  const [y, m] = today.split("-").map(Number);
  const first = new Date(y, m - 2, 1);
  const last = new Date(y, m - 1, 0);
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return [key(first), key(last)];
}
