"use client";

import { useMemo } from "react";
import { dateKey, fromDateKey } from "./format";
import { useCollection, useStaff } from "./hooks";
import { shiftOn, useTeam } from "./settings";
import { store, type Row } from "./store";
import type { Booking, Customer, Gender, Staff } from "./types";

/* Who should handle a patient.
   1. A patient stays with the physio who handled them first (or the one the desk set as theirs).
   2. A new patient goes to a physio of the patient's gender, the one with the fewest patients that month,
      so over a month every physio handles about the same number.
   The desk can always pick someone else; this only decides who is suggested. */

/** First and last day of the calendar month a date is in. */
export function monthOf(key: string) {
  const d = fromDateKey(key);
  return { from: `${key.slice(0, 8)}01`, to: dateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
}

export interface StaffLoad {
  /** Different patients handled, or booked, in the month. */
  patients: number;
  sessions: number;
}

/** Patients and sessions per physio from a month's bookings. Cancelled bookings don't count. */
export function monthLoads(bookings: Booking[]) {
  const seen = new Map<string, Set<string>>();
  const sessions = new Map<string, number>();
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    seen.set(b.staffId, (seen.get(b.staffId) ?? new Set()).add(b.customerId));
    sessions.set(b.staffId, (sessions.get(b.staffId) ?? 0) + 1);
  }
  const out = new Map<string, StaffLoad>();
  for (const [id, set] of seen) out.set(id, { patients: set.size, sessions: sessions.get(id) ?? 0 });
  return out;
}

/** The physio who handled this patient first: their earliest session that took place, else their earliest booking. */
export function firstTherapist(history: Booking[], now = Date.now()) {
  const live = history.filter((b) => b.status !== "cancelled").sort((a, b) => a.startAt - b.startAt);
  const first = live.find((b) => b.status === "paid" || b.status === "in_session" || !!b.endedAt) ?? live.find((b) => b.startAt <= now) ?? live[0];
  return first?.staffId ?? null;
}

const WORD: Record<Gender, string> = { L: "pria", P: "wanita" };

export interface Advice {
  staffId: string;
  /** own: the patient's own physio. cover: their physio is off that day. balance: a new patient, evened out. */
  kind: "own" | "cover" | "balance";
  text: string;
}

export function recommend(input: {
  /** Active physios, in calendar order. */
  staff: Row<Staff>[];
  /** The patient's own physio, if they have one. */
  ownId: string | null;
  /** The gender the physio should have: the patient's, unless they asked otherwise. */
  want?: Gender | null;
  loads: Map<string, StaffLoad>;
  /** A day off on the date of the session. */
  off?: (staffId: string) => boolean;
  /** Patients each physio has at that moment, to break a tie. */
  busy?: Record<string, number>;
}): Advice | null {
  const { staff, loads, want } = input;
  if (!staff.length) return null;
  const off = input.off ?? (() => false);
  const own = staff.find((s) => s.id === input.ownId) ?? null;
  if (own && !off(own.id)) return { staffId: own.id, kind: "own", text: "Fisioterapis tetap pasien ini." };

  const working = staff.filter((s) => !off(s.id));
  const pool = working.length ? working : staff;
  const same = want ? pool.filter((s) => s.gender === want) : pool;
  const from = same.length ? same : pool;
  const n = (s: Row<Staff>) => loads.get(s.id) ?? { patients: 0, sessions: 0 };
  const pick = [...from].sort(
    (a, b) =>
      n(a).patients - n(b).patients ||
      n(a).sessions - n(b).sessions ||
      (input.busy?.[a.id] ?? 0) - (input.busy?.[b.id] ?? 0) ||
      a.order - b.order,
  )[0];
  const count = n(pick).patients;
  const who = want && same.length ? `fisioterapis ${WORD[want]}` : "fisioterapis";
  const least = `${who} dengan pasien paling sedikit bulan ini (${count} pasien)`;
  const noMatch = want && !same.length ? ` Tidak ada fisioterapis ${WORD[want]} yang bertugas.` : "";
  if (own) return { staffId: pick.id, kind: "cover", text: `${own.name} libur di tanggal ini. Pengganti: ${least}.${noMatch}` };
  return { staffId: pick.id, kind: "balance", text: `Pasien baru: ${least}.${noMatch}` };
}

/** Everything a therapist picker needs for one patient on one date. */
export function useAdvice(input: {
  /** Off while the picker is closed. */
  enabled: boolean;
  customer: (Pick<Customer, "primaryStaffId"> & { id: string }) | null | undefined;
  /** The date of the session (YYYY-MM-DD). */
  day: string;
  want?: Gender | null;
  busy?: Record<string, number>;
}) {
  const { enabled, customer, day, want, busy } = input;
  const { staff } = useStaff();
  const { team } = useTeam();
  const month = useMemo(() => monthOf(day), [day]);
  const { rows: monthRows } = useCollection<Booking>(enabled ? "bookings" : null, [
    ["dateKey", ">=", month.from],
    ["dateKey", "<=", month.to],
  ]);
  const { rows: history } = useCollection<Booking>(enabled && customer ? "bookings" : null, [["customerId", "==", customer?.id ?? ""]]);

  return useMemo(() => {
    const loads = monthLoads(monthRows ?? []);
    const ready = enabled && !!monthRows && (!customer || !!history) && staff.length > 0;
    // Only someone with a schedule can be "off": without one, nothing is known about their days.
    const member = new Map(team.filter((t) => t.staffId && t.schedule && Object.keys(t.schedule).length).map((t) => [t.staffId!, t]));
    const off = (id: string) => member.has(id) && !shiftOn(member.get(id), day);
    const ownId = customer ? (customer.primaryStaffId ?? firstTherapist(history ?? [])) : null;
    const own = staff.find((s) => s.id === ownId) ?? null;
    const advice = ready ? recommend({ staff, ownId: own?.id ?? null, want, loads, off, busy }) : null;
    return { advice, loads, own, ready, off, staff };
  }, [enabled, monthRows, history, customer, staff, team, day, want, busy]);
}

/** The desk sets, or clears, whose patient this is. Cleared = the physio who handled them first. */
export const setOwnTherapist = (customerId: string, staffId: string | null) => store.update("customers", customerId, { primaryStaffId: staffId });
