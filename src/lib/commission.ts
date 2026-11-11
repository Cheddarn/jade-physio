"use client";

import { useMemo } from "react";
import { store, type Row } from "./store";
import { useDoc } from "./hooks";
import { addDays } from "./format";
import { shiftOn } from "./settings";
import type { Attendance, Booking, CommissionRate, CommissionSettings, CommissionSnapshot, PayDay, Staff, TeamMember } from "./types";

/* ---------------- Settings (meta/commission) ---------------- */

export const NO_RATE: CommissionRate = { type: "none", value: 0 };

export const DEFAULT_COMMISSION: CommissionSettings = {
  enabled: false,
  since: null,
  holdUntilReport: false,
  defaultRate: { type: "percent", value: 0 },
  rates: {},
  staffOff: [],
  compensation: { enabled: false, amount: 0, since: null, basis: "attendance" },
};

/** Fill in anything an older saved copy doesn't have yet. */
export function withDefaults(row?: Partial<CommissionSettings> | null): CommissionSettings {
  return {
    ...DEFAULT_COMMISSION,
    ...(row ?? {}),
    defaultRate: row?.defaultRate ?? DEFAULT_COMMISSION.defaultRate,
    rates: row?.rates ?? {},
    staffOff: row?.staffOff ?? [],
    compensation: { ...DEFAULT_COMMISSION.compensation, ...(row?.compensation ?? {}) },
  };
}

export function useCommission() {
  const { row, loading } = useDoc<CommissionSettings>("meta", "commission");
  const settings = useMemo(() => withDefaults(row), [row]);
  return { settings, loading };
}

export async function saveCommission(next: CommissionSettings) {
  await store.set("meta", "commission", next);
}

/** Read once, outside a transaction. Empty when it can't be read, so checkout never stops on it. */
export async function loadCommission(): Promise<CommissionSettings | null> {
  try {
    const row = await store.get<CommissionSettings>("meta", "commission");
    return row ? withDefaults(row) : null;
  } catch {
    return null;
  }
}

/* ---------------- Rates ---------------- */

export const rateFor = (s: CommissionSettings, serviceId: string): CommissionRate => s.rates[serviceId] ?? s.defaultRate;

export function rateAmount(rate: CommissionRate, price: number) {
  if (rate.type === "percent") return Math.max(0, Math.round((price * rate.value) / 100));
  if (rate.type === "flat") return Math.max(0, Math.round(rate.value));
  return 0;
}

export function rateText(rate: CommissionRate) {
  if (rate.type === "percent") return rate.value ? `${String(rate.value).replace(".", ",")}%` : "0%";
  if (rate.type === "flat") return `Rp ${Math.round(rate.value).toLocaleString("id-ID")}`;
  return "Tanpa komisi";
}

type Session = Pick<Booking, "staffId" | "serviceId" | "price" | "dateKey">;

/** Does this session earn commission under these rules: switched on, the physio takes part, and on or after the start date. */
export const eligible = (s: CommissionSettings | null | undefined, b: Session): s is CommissionSettings =>
  !!s?.enabled && !s.staffOff.includes(b.staffId) && (!s.since || b.dateKey >= s.since);

/** What a session earns under the rules as they are now. */
export function snapshotFor(s: CommissionSettings | null | undefined, b: Session): CommissionSnapshot {
  if (!eligible(s, b)) return { ...NO_RATE, amount: 0 };
  const rate = rateFor(s, b.serviceId);
  return { type: rate.type, value: rate.value, amount: rateAmount(rate, b.price) };
}

/**
 * What checkout writes on the session. Earned commission is frozen there; a session that earns nothing
 * at that moment (commission off, before the start date) is left open, and follows the rules if they later cover it.
 */
export const earnedAt = (s: CommissionSettings | null | undefined, b: Session): CommissionSnapshot | null => (eligible(s, b) ? snapshotFor(s, b) : null);

/* ---------------- Pay per physio ---------------- */

export interface SessionPay {
  b: Row<Booking>;
  amount: number;
  rate: CommissionRate;
  /** Not frozen yet (not paid at the desk): worked out from today's rates, and may still change. */
  estimated: boolean;
  /** Waiting for the therapy report. */
  held: boolean;
}

export interface DayPay {
  dateKey: string;
  sessions: SessionPay[];
  commission: number;
  held: number;
  /** At work that day (clocked in, or on shift, whichever the manager chose). */
  worked: boolean;
  compensation: number;
  compKind: "auto" | "manual" | null;
  note?: string;
}

export interface StaffPay {
  staff: Row<Staff>;
  excluded: boolean;
  days: DayPay[];
  sessions: number;
  commission: number;
  held: number;
  heldSessions: number;
  compensation: number;
  compDays: number;
  total: number;
}

export const payDayId = (staffId: string, key: string) => `${staffId}_${key}`;

/**
 * Days each physio was at work, by the rule the manager picked:
 * "attendance" counts a clock-in, "shift" counts a shift on the weekly schedule.
 */
export function workdays(
  basis: CommissionSettings["compensation"]["basis"],
  input: { attendance: Attendance[]; team: Row<TeamMember>[]; from: string; to: string },
) {
  const out = new Map<string, Set<string>>();
  const add = (staffId: string, key: string) => out.set(staffId, (out.get(staffId) ?? new Set()).add(key));
  const members = input.team.filter((t) => t.staffId);
  if (basis === "attendance") {
    const staffOf = new Map(members.map((t) => [t.id, t.staffId!]));
    for (const a of input.attendance) {
      const staffId = staffOf.get(a.email);
      if (staffId && a.dateKey >= input.from && a.dateKey <= input.to) add(staffId, a.dateKey);
    }
  } else {
    for (const t of members) for (let d = input.from; d <= input.to; d = addDays(d, 1)) if (shiftOn(t, d)) add(t.staffId!, d);
  }
  return out;
}

export function payroll(input: {
  settings: CommissionSettings;
  staff: Row<Staff>[];
  /** Bookings in the range. */
  bookings: Row<Booking>[];
  /** The session took place: paid, or the physio pressed "Sesi selesai". */
  isDone: (b: Row<Booking>) => boolean;
  hasReport: (b: Row<Booking>) => boolean;
  workdays: Map<string, Set<string>>;
  overrides: Row<PayDay>[];
  from: string;
  to: string;
  today: string;
}): StaffPay[] {
  const { settings: s, from, today } = input;
  const to = input.to > today ? today : input.to;
  const override = new Map(input.overrides.map((o) => [payDayId(o.staffId, o.dateKey), o]));
  const comp = s.compensation;

  return input.staff.map((staff) => {
    const excluded = s.staffOff.includes(staff.id);
    const byDay = new Map<string, SessionPay[]>();
    for (const b of input.bookings) {
      if (b.staffId !== staff.id || b.status === "cancelled" || !input.isDone(b)) continue;
      if (b.dateKey < from || b.dateKey > to) continue;
      const snap = b.commission ?? snapshotFor(s, b);
      const held = s.holdUntilReport && snap.amount > 0 && !input.hasReport(b);
      byDay.set(b.dateKey, [...(byDay.get(b.dateKey) ?? []), { b, amount: snap.amount, rate: snap, estimated: !b.commission && b.status !== "paid", held }]);
    }
    const worked = input.workdays.get(staff.id) ?? new Set<string>();
    const days: DayPay[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const sessions = (byDay.get(d) ?? []).sort((a, b) => a.b.startAt - b.b.startAt);
      const manual = override.get(payDayId(staff.id, d));
      // Today can still bring a patient, so it only counts once the day is over.
      const auto = comp.enabled && !excluded && d < today && (!comp.since || d >= comp.since) && worked.has(d) && sessions.length === 0;
      const compensation = manual ? manual.compensation : auto ? comp.amount : 0;
      if (!sessions.length && !manual && !worked.has(d)) continue;
      days.push({
        dateKey: d,
        sessions,
        commission: sessions.reduce((n, x) => n + (x.held ? 0 : x.amount), 0),
        held: sessions.reduce((n, x) => n + (x.held ? x.amount : 0), 0),
        worked: worked.has(d),
        compensation,
        compKind: manual ? "manual" : auto ? "auto" : null,
        note: manual?.note,
      });
    }
    const commission = days.reduce((n, d) => n + d.commission, 0);
    const compensation = days.reduce((n, d) => n + d.compensation, 0);
    return {
      staff,
      excluded,
      days,
      sessions: days.reduce((n, d) => n + d.sessions.length, 0),
      commission,
      held: days.reduce((n, d) => n + d.held, 0),
      heldSessions: days.reduce((n, d) => n + d.sessions.filter((x) => x.held).length, 0),
      compensation,
      compDays: days.filter((d) => d.compensation > 0).length,
      total: commission + compensation,
    };
  });
}

/* ---------------- The manager's own figure for a day ---------------- */

export async function setPayDay(staffId: string, key: string, compensation: number, note: string, by: { email: string; name: string }) {
  const doc: PayDay = { staffId, dateKey: key, compensation: Math.max(0, Math.round(compensation)), note: note.trim(), by: by.email, byName: by.name, at: Date.now() };
  await store.set("payDays", payDayId(staffId, key), doc);
}

export const clearPayDay = (staffId: string, key: string) => store.remove("payDays", payDayId(staffId, key));

/* ---------------- Export ---------------- */

/** One row per physio per day, for payroll in a spreadsheet. */
export function payrollCsv(rows: StaffPay[]) {
  const head = ["Tanggal", "Fisioterapis", "Sesi", "Komisi", "Komisi ditahan", "Kompensasi harian", "Total", "Keterangan"];
  const lines: (string | number)[][] = [];
  for (const r of rows)
    for (const d of r.days) {
      if (!d.sessions.length && !d.compensation) continue;
      lines.push([
        d.dateKey,
        r.staff.name,
        d.sessions.length,
        d.commission,
        d.held,
        d.compensation,
        d.commission + d.compensation,
        d.compKind === "manual" ? `Kompensasi diatur manual${d.note ? `: ${d.note}` : ""}` : d.compKind === "auto" ? "Hari tanpa pasien" : "",
      ]);
    }
  lines.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])));
  for (const r of rows) if (r.sessions || r.compensation) lines.push(["TOTAL", r.staff.name, r.sessions, r.commission, r.held, r.compensation, r.total, ""]);
  return "﻿" + [head, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}
