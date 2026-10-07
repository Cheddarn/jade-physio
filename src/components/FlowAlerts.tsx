"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useUser } from "@/lib/auth";
import { can as canRole, isStaffRole } from "@/lib/roles";
import { useCollection, useNow, useStaff } from "@/lib/hooks";
import { dateKey, shortDate, time } from "@/lib/format";
import { tasksFor, type Task, type VisitRow } from "@/lib/flow";
import { isRoutineSeenKey, lastRoutineAt, readRoutineSeen, useDueMemos, writeRoutineSeen } from "@/lib/memos";
import { hoursOn, useSettings } from "@/lib/settings";
import type { Row } from "@/lib/store";
import type { Booking, BookingRequest, Memo, Routine, TherapyReport, Visit } from "@/lib/types";
import { useToast } from "./ui";

interface AlertsApi {
  /** Everything that pings: patient flow, missing reports, booking requests. */
  tasks: Task[];
  visits: VisitRow[] | null;
  /** Red counts on menu items, by link. */
  badges: Record<string, number>;
  /** Bookings today that already have a therapy report. */
  reported: Set<string>;
  sound: boolean;
  setSound: (on: boolean) => void;
  notifyAllowed: boolean | null; // null: browser has no notifications
  askNotify: () => void;
  /** Dated reminders whose time has come and nobody has confirmed. */
  memos: Row<Memo>[];
  /** Routine nudges due for this admin now, with when they came up. */
  routines: (Routine & { at: number })[];
  confirmRoutine: (id: string) => void;
}

const Ctx = createContext<AlertsApi>({
  tasks: [],
  visits: null,
  badges: {},
  reported: new Set(),
  sound: true,
  setSound: () => {},
  notifyAllowed: null,
  askNotify: () => {},
  memos: [],
  routines: [],
  confirmRoutine: () => {},
});
export const useFlowAlerts = () => useContext(Ctx);

const SOUND_KEY = "jade-physio-sound";

/** Two-tone chime, no audio file needed. */
function chime() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.55);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    /* audio blocked until the first tap: the toast still shows */
  }
}

/** Watches today's visits and pings this person when a task for their role appears. */
export function FlowAlertsProvider({ children }: { children: ReactNode }) {
  const user = useUser();
  const toast = useToast();
  const now = useNow(30_000);
  const today = dateKey(now);
  // Patients only see their own portal, never the clinic's live board.
  const { rows: visits } = useCollection<Visit>(isStaffRole(user.role) ? "visits" : null, [["dateKey", "==", today]]);
  const { staff } = useStaff(true);
  const flowTasks = useMemo(() => (visits ? tasksFor(user, visits, staff) : []), [visits, staff, user]);

  // Therapy reports: a physio is reminded for every finished session without one.
  const clinical = canRole(user.role, "reports.view");
  const { rows: bookings } = useCollection<Booking>(clinical ? "bookings" : null, [["dateKey", "==", today]]);
  const { rows: reportRows } = useCollection<TherapyReport>(clinical ? "reports" : null, [["dateKey", "==", today]]);
  const reported = useMemo(() => new Set((reportRows ?? []).map((r) => r.bookingId)), [reportRows]);
  const missing = useMemo(() => {
    const finished = new Set((visits ?? []).filter((v) => v.stage === "finished" && v.bookingId).map((v) => v.bookingId!));
    return (bookings ?? []).filter(
      (b) =>
        b.status !== "cancelled" &&
        (b.status === "paid" || finished.has(b.id)) &&
        !reported.has(b.id) &&
        (user.role !== "therapist" || b.staffId === user.staffId),
    );
  }, [bookings, visits, reported, user]);
  const reportTasks = useMemo<Task[]>(
    () =>
      user.role !== "therapist"
        ? []
        : missing.map((b) => ({
            id: `${b.id}:report`,
            visitId: (visits ?? []).find((v) => v.bookingId === b.id)?.id ?? "",
            title: "Buat laporan terapi",
            body: `${b.customerName}, ${b.serviceName}`,
          })),
    [missing, visits, user.role],
  );

  // Patients booking from the portal: the front desk confirms.
  const desk = canRole(user.role, "requests.manage");
  const { rows: requests } = useCollection<BookingRequest>(desk ? "requests" : null, [["status", "==", "pending"]]);
  const requestTasks = useMemo<Task[]>(
    () =>
      (requests ?? []).map((r) => ({
        id: `req:${r.id}`,
        visitId: "",
        groupId: r.batchId,
        title: "Permintaan booking dari pasien",
        body: `${r.personName}, ${shortDate(r.startAt)} ${time(r.startAt)}`,
      })),
    [requests],
  );

  // The desk's dated reminders, once their day (and time) comes.
  const memoDesk = canRole(user.role, "memos");
  const { due: memos, loaded: memosLoaded } = useDueMemos(memoDesk, now);

  // Routine nudges such as "balas DM TikTok", for the admin at the desk while the clinic is open.
  const { settings } = useSettings();
  const routineIds = settings.routines.map((r) => r.id).join("|");
  const [routineSeen, setRoutineSeen] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    const load = () => setRoutineSeen(Object.fromEntries(routineIds.split("|").filter(Boolean).map((id) => [id, readRoutineSeen(id)])));
    load();
    // Confirmed in another tab: hide it here too.
    const onStorage = (e: StorageEvent) => isRoutineSeenKey(e.key) && load();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [routineIds]);
  const confirmRoutine = useCallback((id: string) => {
    const at = Date.now();
    writeRoutineSeen(id, at);
    setRoutineSeen((s) => ({ ...s, [id]: at }));
  }, []);
  const routines = useMemo(() => {
    if (user.role !== "admin" || !routineSeen) return [];
    const hours = hoursOn(settings, today);
    return settings.routines.flatMap((r) => {
      const at = lastRoutineAt(r, hours, now);
      return at != null && at > (routineSeen[r.id] ?? 0) ? [{ ...r, at }] : [];
    });
  }, [user.role, routineSeen, settings, today, now]);
  const reminderTasks = useMemo<Task[]>(
    () => [
      ...memos.map((m) => ({ id: `memo:${m.id}`, visitId: "", title: "Pengingat", body: m.text })),
      // One id per occurrence, so every hour pings again.
      ...routines.map((r) => ({ id: `routine:${r.id}:${r.at}`, visitId: "", title: "Pengingat rutin", body: r.text })),
    ],
    [memos, routines],
  );

  const tasks = useMemo(
    () => [...flowTasks, ...reportTasks, ...requestTasks, ...reminderTasks],
    [flowTasks, reportTasks, requestTasks, reminderTasks],
  );
  const badges = useMemo(
    () => ({
      "/alur": flowTasks.length + reportTasks.filter((t) => t.visitId).length,
      "/laporan-terapi": missing.length,
      "/kalender": requests?.length ?? 0,
      "/pengingat": memos.length + routines.length,
    }),
    [flowTasks, reportTasks, missing, requests, memos, routines],
  );


  const [sound, setSoundState] = useState(true);
  const [notifyAllowed, setNotifyAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      setSoundState(window.localStorage.getItem(SOUND_KEY) !== "0");
    } catch {
      /* ignore */
    }
    if ("Notification" in window) setNotifyAllowed(Notification.permission === "granted");
  }, []);
  const setSound = useCallback((on: boolean) => {
    setSoundState(on);
    try {
      window.localStorage.setItem(SOUND_KEY, on ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (on) chime();
  }, []);
  const askNotify = useCallback(() => {
    if (!("Notification" in window)) return;
    Notification.requestPermission().then((p) => setNotifyAllowed(p === "granted"));
  }, []);

  // Alert only for tasks that appear after the first load, once each.
  const seen = useRef<Set<string> | null>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  useEffect(() => {
    // Wait for everything that pings, so what is already there on load stays quiet.
    if (!visits || (memoDesk && !memosLoaded) || !routineSeen) return;
    if (!seen.current) {
      seen.current = new Set(tasks.map((t) => t.id));
      return;
    }
    const fresh = tasks.filter((t) => !seen.current!.has(t.id));
    tasks.forEach((t) => seen.current!.add(t.id));
    if (!fresh.length) return;
    if (soundRef.current) chime();
    // Browsers only allow vibration after the person has tapped the page once.
    if ((navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive)
      navigator.vibrate?.([120, 80, 120]);
    // A family checking in together gives one alert per step, not one per person.
    const merged = new Map<string, Task>();
    for (const t of fresh) {
      const key = t.groupId ? `${t.groupId}|${t.title}` : t.id;
      const prev = merged.get(key);
      merged.set(key, prev ? { ...prev, body: `${prev.body}; ${t.body}` } : t);
    }
    for (const t of merged.values()) {
      // Reminders have their own popup until confirmed; they only chime and notify.
      if (!/^(memo|routine):/.test(t.id)) toast(`${t.title}: ${t.body}`);
      if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
        try {
          new Notification(t.title, { body: t.body, tag: t.id });
        } catch {
          /* some mobile browsers only allow notifications from a service worker */
        }
      }
    }
  }, [tasks, visits, memoDesk, memosLoaded, routineSeen, toast]);

  // Show the count in the browser tab, so a background tab still catches the eye.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = tasks.length ? `(${tasks.length}) ${base}` : base;
  }, [tasks.length]);

  const value = useMemo(
    () => ({ tasks, visits, badges, reported, sound, setSound, notifyAllowed, askNotify, memos, routines, confirmRoutine }),
    [tasks, visits, badges, reported, sound, setSound, notifyAllowed, askNotify, memos, routines, confirmRoutine],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
