"use client";

import { useMemo } from "react";
import { store, type Row } from "./store";
import { useCollection, useDoc } from "./hooks";
import { BUSINESS, dateKey, fromDateKey, pad } from "./format";
import { normalizeRole } from "./roles";
import type { Attendance, DayHours, Settings, TeamMember, Week } from "./types";

/* ---------------- Clinic settings (meta/settings) ---------------- */

export const WEEKDAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
/** Monday first, the way the clinic reads a week. */
export const WEEK_ORDER = ["1", "2", "3", "4", "5", "6", "0"];

const allDays = (h: DayHours | null): Week => Object.fromEntries(WEEK_ORDER.map((d) => [d, h]));

export const DEFAULT_SETTINGS: Settings = {
  hours: allDays({ start: `${pad(BUSINESS.openHour)}:00`, end: `${pad(BUSINESS.closeHour)}:00` }),
  reminderDays: 7,
};

export function useSettings() {
  const { row, loading } = useDoc<Settings>("meta", "settings");
  const settings = useMemo<Settings>(
    () => ({
      hours: { ...DEFAULT_SETTINGS.hours, ...(row?.hours ?? {}) },
      reminderDays: row?.reminderDays ?? DEFAULT_SETTINGS.reminderDays,
    }),
    [row],
  );
  return { settings, loading };
}

export async function saveSettings(patch: Partial<Settings>) {
  const cur = await store.get<Settings>("meta", "settings");
  const { id: _id, ...rest } = (cur ?? DEFAULT_SETTINGS) as Row<Settings>;
  await store.set("meta", "settings", { ...DEFAULT_SETTINGS, ...rest, ...patch });
}

/** Opening hours for a date ("YYYY-MM-DD"), or null when closed. */
export const hoursOn = (s: Settings, key: string) => s.hours[String(fromDateKey(key).getDay())] ?? null;

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};
export const fromMin = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
export const dot = (hhmm?: string | null) => (hhmm ? hhmm.replace(":", ".") : "");

/* ---------------- Team and shifts (team/{email}) ---------------- */

export function useTeam(includeInactive = false) {
  const { rows, loading } = useCollection<TeamMember>("team");
  const team = useMemo(
    () =>
      (rows ?? [])
        .filter((t) => includeInactive || t.active)
        .map((t) => ({ ...t, role: normalizeRole(t.role) ?? t.role }))
        .sort((a, b) => a.name.localeCompare(b.name, "id")),
    [rows, includeInactive],
  );
  return { team, loading };
}

/** The shift for one person on one date, or null on a day off / no schedule set. */
export function shiftOn(member: TeamMember | undefined | null, key: string): DayHours | null {
  return member?.schedule?.[String(fromDateKey(key).getDay())] ?? null;
}

export async function saveTeamMember(email: string, data: Partial<TeamMember>) {
  const cur = await store.get<TeamMember>("team", email);
  if (cur) await store.update("team", email, data);
  else await store.set("team", email, { name: email, role: "admin", active: true, schedule: {}, ...data });
}

/* ---------------- Attendance (attendance/{email}_{dateKey}) ---------------- */

export const attendanceId = (email: string, key: string) => `${email}_${key}`;

export function useMyAttendance(email: string, key = dateKey()) {
  return useDoc<Attendance>("attendance", email ? attendanceId(email, key) : null);
}

/** Minutes worked past the end of the shift (or closing time when no shift is set). */
export function overtimeAt(a: Pick<Attendance, "dateKey" | "shiftEnd">, at: number) {
  if (!a.shiftEnd) return 0;
  const end = fromDateKey(a.dateKey).getTime() + toMin(a.shiftEnd) * 60_000;
  return Math.max(0, Math.round((at - end) / 60_000));
}

export async function clockIn(
  user: { email: string; name: string; role: string },
  member: TeamMember | undefined,
  settings: Settings,
) {
  const key = dateKey();
  // A person without their own shift follows the clinic's hours that day.
  const shift = shiftOn(member, key) ?? hoursOn(settings, key);
  const a: Attendance = {
    email: user.email,
    name: member?.name || user.name,
    role: user.role,
    dateKey: key,
    inAt: Date.now(),
    outAt: null,
    shiftStart: shift?.start ?? null,
    shiftEnd: shift?.end ?? null,
    overtimeMin: 0,
    closing: null,
  };
  await store.set("attendance", attendanceId(user.email, key), a);
}

/** Pulang: overtime is counted automatically against the shift end. */
export async function clockOut(a: Row<Attendance>, note?: string) {
  const outAt = Date.now();
  const overtimeMin = overtimeAt(a, outAt);
  await store.update("attendance", a.id, {
    outAt,
    overtimeMin,
    closing: overtimeMin >= OVERTIME_GRACE ? "overtime" : "normal",
    note: note?.trim() ?? "",
  });
}

/** Overtime grace: a few minutes after the shift is still a normal closing. */
export const OVERTIME_GRACE = 5;

export function durationText(min: number) {
  if (min < 60) return `${min} mnt`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} j ${m} mnt` : `${h} jam`;
}

/** "8 jam 12 menit": spelled out for attendance, where people read it closely. */
export function durationLong(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} menit`;
  return m ? `${h} jam ${m} menit` : `${h} jam`;
}

/** Minutes between clocking in and out (or now, while still at work). */
export const workedMin = (a: Pick<Attendance, "inAt" | "outAt">, now = Date.now()) =>
  Math.max(0, Math.round(((a.outAt ?? now) - a.inAt) / 60_000));

/** Manager correction, e.g. someone forgot to clock out. Overtime is recalculated. */
export async function correctAttendance(a: Row<Attendance>, inHHMM: string, outHHMM: string | null, note: string) {
  const day = fromDateKey(a.dateKey).getTime();
  const inAt = day + toMin(inHHMM) * 60_000;
  let outAt = outHHMM ? day + toMin(outHHMM) * 60_000 : null;
  if (outAt != null && outAt < inAt) outAt += 86_400_000; // past midnight
  const overtimeMin = outAt ? overtimeAt(a, outAt) : 0;
  await store.update("attendance", a.id, {
    inAt,
    outAt,
    overtimeMin,
    closing: outAt ? (overtimeMin >= OVERTIME_GRACE ? "overtime" : "normal") : null,
    note: note.trim(),
  });
}

/** Spreadsheet-friendly month export for payroll. */
export function attendanceCsv(rows: Attendance[]) {
  const t = (ms: number | null) => (ms ? new Date(ms).toTimeString().slice(0, 5) : "");
  const head = ["Tanggal", "Nama", "Peran", "Shift mulai", "Shift selesai", "Masuk", "Pulang", "Lama kerja (menit)", "Lembur (menit)", "Status", "Catatan"];
  const lines = rows
    .slice()
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.name.localeCompare(b.name))
    .map((a) => [
      a.dateKey,
      a.name,
      a.role,
      a.shiftStart ?? "",
      a.shiftEnd ?? "",
      t(a.inAt),
      t(a.outAt),
      a.outAt ? String(workedMin(a)) : "",
      String(a.overtimeMin || 0),
      a.outAt ? (a.closing === "overtime" ? "Lembur" : "Normal") : "Belum pulang",
      a.note ?? "",
    ]);
  return [head, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}
