import { useMemo } from "react";
import { store, type Row } from "./store";
import { useCollection } from "./hooks";
import { addDays, atTime, dateKey, fromDateKey, pad } from "./format";
import { dot } from "./settings";
import type { DayHours, Memo, Routine } from "./types";

/* The desk's own reminders on the calendar (collection "memos"). Not the WhatsApp appointment reminders in reminders.ts. */

type Who = { email: string; name: string };

const clock = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Its day has come and, if it has a time, that time has passed. */
export const memoDue = (m: Memo, now = Date.now()) => {
  const today = dateKey(now);
  return m.dateKey < today || (m.dateKey === today && (!m.time || m.time <= clock(now)));
};

/** By day, then whole-day reminders before timed ones, then by time. */
export const byWhen = (a: Memo, b: Memo) => a.dateKey.localeCompare(b.dateKey) || (a.time ?? "").localeCompare(b.time ?? "");

/** "Hari ini, 14.00", "Kemarin", "Sen, 5 Okt, 09.00". */
export function memoWhen(m: Memo, today = dateKey()) {
  const day =
    m.dateKey === today
      ? "Hari ini"
      : m.dateKey === addDays(today, -1)
        ? "Kemarin"
        : m.dateKey === addDays(today, 1)
          ? "Besok"
          : fromDateKey(m.dateKey).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
  return m.time ? `${day}, ${dot(m.time)}` : day;
}

/** Reminders nobody has confirmed yet whose time has come, oldest first. */
export function useDueMemos(enabled: boolean, now: number) {
  const { rows } = useCollection<Memo>(enabled ? "memos" : null, [["seenAt", "==", null]]);
  const due = useMemo(() => (rows ?? []).filter((m) => memoDue(m, now)).sort(byWhen), [rows, now]);
  return { due, loaded: rows !== null };
}

export function useMemosOn(day: string, enabled = true) {
  const { rows, loading } = useCollection<Memo>(enabled ? "memos" : null, [["dateKey", "==", day]]);
  const memos = useMemo(() => [...(rows ?? [])].sort(byWhen), [rows]);
  return { memos, loading };
}

/** From today on, soonest first. */
export function useUpcomingMemos(enabled: boolean) {
  const { rows } = useCollection<Memo>(enabled ? "memos" : null, [["dateKey", ">=", dateKey()]]);
  return useMemo(() => [...(rows ?? [])].sort(byWhen), [rows]);
}

/** Moving a reminder to another day or time makes it pop up again there. */
export async function saveMemo(memo: Row<Memo> | null, data: Pick<Memo, "dateKey" | "time" | "text">, by: Who) {
  if (!memo) {
    await store.add("memos", {
      ...data,
      createdBy: by.email,
      createdByName: by.name,
      createdAt: Date.now(),
      seenAt: null,
      seenBy: null,
      seenByName: null,
    } satisfies Memo);
    return;
  }
  const moved = memo.dateKey !== data.dateKey || memo.time !== data.time;
  await store.update("memos", memo.id, moved ? { ...data, seenAt: null, seenBy: null, seenByName: null } : data);
}

export const markMemoSeen = (id: string, by: Who) => store.update("memos", id, { seenAt: Date.now(), seenBy: by.email, seenByName: by.name });

export const removeMemo = (id: string) => store.remove("memos", id);

/* ---------------- Routine reminders (settings.routines) ---------------- */

/**
 * When this routine last came up today: at opening, then every `everyMin` minutes until closing.
 * Null before opening, on a closed day, or when it is switched off.
 */
export function lastRoutineAt(r: Routine, hours: DayHours | null, now = Date.now()): number | null {
  if (!r.on || !hours || r.everyMin < 5) return null;
  const today = dateKey(now);
  const start = atTime(today, hours.start);
  const end = atTime(today, hours.end);
  if (now < start || end <= start) return null;
  const step = r.everyMin * 60_000;
  return start + Math.floor((Math.min(now, end - 1) - start) / step) * step;
}

/** "setiap 1 jam", "setiap 30 menit". */
export const everyText = (min: number) => (min % 60 === 0 ? `setiap ${min / 60} jam` : `setiap ${min} menit`);

// Each device remembers when it last confirmed a routine, so every admin on duty gets the nudge.
const seenKey = (id: string) => `jade-physio-routine-seen:${id}`;

export function readRoutineSeen(id: string) {
  try {
    return Number(window.localStorage.getItem(seenKey(id))) || 0;
  } catch {
    return 0;
  }
}

export function writeRoutineSeen(id: string, at: number) {
  try {
    window.localStorage.setItem(seenKey(id), String(at));
  } catch {
    /* private mode: it shows again on the next load */
  }
}

export const isRoutineSeenKey = (key: string | null) => !!key?.startsWith("jade-physio-routine-seen:");
