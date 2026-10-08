"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useUser } from "@/lib/auth";
import { can as canRole, isStaffRole } from "@/lib/roles";
import { useCollection, useNow, useStaff } from "@/lib/hooks";
import { dateKey, shortDate, time } from "@/lib/format";
import { tasksFor, type Task, type VisitRow } from "@/lib/flow";
import { isRoutineSeenKey, lastRoutineAt, readRoutineSeen, useDueMemos, writeRoutineSeen } from "@/lib/memos";
import { hoursOn, useSettings } from "@/lib/settings";
import { restockStatus } from "@/lib/restock";
import type { Row } from "@/lib/store";
import type { Booking, BookingRequest, Memo, RestockItem, Routine, TherapyReport, Visit } from "@/lib/types";
import { useToast } from "./ui";

/** Something worth a ping that is not a to-do: a new booking for a physio, an answer to a patient's request. */
interface Notice {
  id: string;
  title: string;
  body: string;
}

interface AlertsApi {
  /** To-dos that ping and are counted: patient flow, missing reports, booking requests, restock, reminders. */
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

// One audio context for the app. Browsers keep it silent until the page has been tapped once,
// so the provider resumes it on the first tap or key press.
let audio: AudioContext | null = null;
function audioContext() {
  if (!audio) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) audio = new AC();
  }
  return audio;
}

/** Two-tone chime, no audio file needed. */
function chime() {
  try {
    const ctx = audioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
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
  } catch {
    /* audio blocked until the first tap: the toast still shows */
  }
}

/** A system notification. Android Chrome only shows them through a service worker (public/sw.js); desktop takes either. */
async function systemNotify(title: string, body: string, tag: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return void (await reg.showNotification(title, { body, tag, icon: "/logo.png" }));
  } catch {
    /* try the plain way below */
  }
  try {
    new Notification(title, { body, tag, icon: "/logo.png" });
  } catch {
    /* nothing more to do: the toast and the chime already went */
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

  // Physios: a new booking with them (made at the desk, or a patient's request confirmed), and patients asking for them.
  const therapist = user.role === "therapist" && !!user.staffId;
  const { rows: ahead } = useCollection<Booking>(therapist ? "bookings" : null, [["dateKey", ">=", today]]);
  const { rows: askedForMe } = useCollection<BookingRequest>(therapist ? "requests" : null, [
    ["status", "==", "pending"],
    ["staffId", "==", user.staffId ?? ""],
  ]);
  const therapistNotices = useMemo<Notice[]>(() => {
    if (!therapist) return [];
    // A walk-in already gets "Pasien baru untuk Anda"; its booking is not news.
    const walkIns = new Set((visits ?? []).map((v) => v.bookingId).filter(Boolean));
    return [
      ...(ahead ?? [])
        .filter((b) => b.staffId === user.staffId && b.status === "booked" && !walkIns.has(b.id))
        .map((b) => ({
          id: `booking:${b.id}:${b.startAt}`,
          title: "Booking baru untuk Anda",
          body: `${b.customerName}, ${shortDate(b.startAt)} ${time(b.startAt)}, ${b.serviceName}`,
        })),
      ...(askedForMe ?? []).map((r) => ({
        id: `asked:${r.id}`,
        title: "Pasien minta booking dengan Anda",
        body: `${r.personName}, ${shortDate(r.startAt)} ${time(r.startAt)}. Menunggu konfirmasi admin.`,
      })),
    ];
  }, [therapist, ahead, askedForMe, visits, user.staffId]);

  // Patients: the clinic answered a booking request.
  const patient = user.role === "patient";
  const { rows: myRequests } = useCollection<BookingRequest>(patient ? "requests" : null, [["accountEmail", "==", user.email]]);
  const patientNotices = useMemo<Notice[]>(
    () =>
      (myRequests ?? []).flatMap((r) => {
        const at = r.confirmedStartAt ?? r.startAt;
        if (r.status === "confirmed")
          return [{
            id: `answer:${r.id}:confirmed`,
            title: "Booking dikonfirmasi",
            body: `${r.personName}, ${shortDate(at)} ${time(at)}${r.confirmedStaffName ? ` dengan ${r.confirmedStaffName}` : ""}`,
          }];
        if (r.status === "rejected")
          return [{ id: `answer:${r.id}:rejected`, title: "Permintaan booking ditolak", body: `${r.personName}${r.reason ? `: ${r.reason}` : ""}` }];
        return [];
      }),
    [myRequests],
  );

  // The manager orders what staff ask for.
  const buyer = canRole(user.role, "restock.manage");
  const { rows: openRestock } = useCollection<RestockItem>(buyer ? "restock" : null, [["done", "==", false]]);
  const restockTasks = useMemo<Task[]>(
    () =>
      (openRestock ?? [])
        .filter((r) => restockStatus(r) === "requested")
        .map((r) => ({
          id: `restock:${r.id}`,
          visitId: "",
          title: r.urgent ? "Restock urgent" : "Permintaan restock",
          body: `${r.item}, ${r.qty} ${r.unit} (${r.createdByName})`,
        })),
    [openRestock],
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
    () => [...flowTasks, ...reportTasks, ...requestTasks, ...restockTasks, ...reminderTasks],
    [flowTasks, reportTasks, requestTasks, restockTasks, reminderTasks],
  );
  const alerts = useMemo<(Task | Notice)[]>(
    () => [...tasks, ...therapistNotices, ...patientNotices],
    [tasks, therapistNotices, patientNotices],
  );
  const badges = useMemo(
    () => ({
      "/alur": flowTasks.length + reportTasks.filter((t) => t.visitId).length,
      "/laporan-terapi": missing.length,
      "/kalender": requests?.length ?? 0,
      "/pengingat": memos.length + routines.length,
      "/restock": restockTasks.length,
    }),
    [flowTasks, reportTasks, missing, requests, memos, routines, restockTasks],
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

  // Sound only plays once the page has been tapped; until then staff see a hint, and the first tap turns it on.
  const [audioLocked, setAudioLocked] = useState(false);
  useEffect(() => {
    if (!(navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive) setAudioLocked(true);
    const unlock = () => {
      setAudioLocked(false);
      try {
        void audioContext()?.resume();
      } catch {
        /* no audio here */
      }
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
  // Phones need a service worker to show notifications.
  useEffect(() => {
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
  }, []);

  // Wait for everything that pings, so what is already there on load stays quiet.
  const ready =
    (!isStaffRole(user.role) || visits !== null) &&
    (!clinical || (bookings !== null && reportRows !== null)) &&
    (!desk || requests !== null) &&
    (!therapist || (ahead !== null && askedForMe !== null)) &&
    (!patient || myRequests !== null) &&
    (!buyer || openRestock !== null) &&
    (!memoDesk || memosLoaded) &&
    routineSeen !== null;

  // Alert only for what appears after the first load, once each. A short pause lets related writes land
  // (a walk-in's booking and its visit), so one change gives one alert.
  const seen = useRef<Set<string> | null>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const latest = useRef(alerts);
  latest.current = alerts;
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const list = latest.current;
      if (!seen.current) {
        seen.current = new Set(list.map((t) => t.id));
        return;
      }
      const fresh = list.filter((t) => !seen.current!.has(t.id));
      list.forEach((t) => seen.current!.add(t.id));
      if (!fresh.length) return;
      if (soundRef.current) chime();
      // Browsers only allow vibration after the person has tapped the page once.
      if ((navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive)
        navigator.vibrate?.([120, 80, 120]);
      // A family checking in together gives one alert per step, not one per person.
      const merged = new Map<string, Task | Notice>();
      for (const t of fresh) {
        const group = "groupId" in t ? t.groupId : null;
        const key = group ? `${group}|${t.title}` : t.id;
        const prev = merged.get(key);
        merged.set(key, prev ? { ...prev, body: `${prev.body}; ${t.body}` } : t);
      }
      for (const t of merged.values()) {
        // Reminders have their own popup until confirmed; they only chime and notify.
        if (!/^(memo|routine):/.test(t.id)) toast(`${t.title}: ${t.body}`);
        if (document.visibilityState !== "visible") void systemNotify(t.title, t.body, t.id);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [alerts, ready, toast]);

  // Show the count in the browser tab, so a background tab still catches the eye.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = tasks.length ? `(${tasks.length}) ${base}` : base;
  }, [tasks.length]);

  const value = useMemo(
    () => ({ tasks, visits, badges, reported, sound, setSound, notifyAllowed, askNotify, memos, routines, confirmRoutine }),
    [tasks, visits, badges, reported, sound, setSound, notifyAllowed, askNotify, memos, routines, confirmRoutine],
  );
  return (
    <Ctx.Provider value={value}>
      {children}
      {audioLocked && sound && isStaffRole(user.role) && (
        <p className="no-print pointer-events-none fixed bottom-[calc(80px+var(--safe-bottom))] left-3 z-40 rounded-full bg-ink/85 px-3.5 py-2 text-[12px] font-semibold text-white shadow-[var(--shadow-lift)] md:bottom-6 md:left-[248px]">
          Ketuk layar sekali untuk menyalakan suara notifikasi
        </p>
      )}
    </Ctx.Provider>
  );
}
