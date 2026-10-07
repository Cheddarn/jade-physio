"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CalendarDays, Check, ChevronLeft, ChevronRight, Globe, Play, Plus, Sparkles, Ticket } from "lucide-react";
import { Avatar, Button, Empty, Fab, IconButton, Segmented, Spinner, cx, errorText, useToast } from "@/components/ui";
import { BookingSheet, type BookingDraft } from "@/components/BookingSheet";
import { BookingDetail, StatusBadge } from "@/components/BookingDetail";
import { useCollection, useCustomers, useMediaQuery, useNow, useStaff } from "@/lib/hooks";
import { useCan, useUser } from "@/lib/auth";
import { canRunSession } from "@/lib/roles";
import { seedCatalog, setBookingStatus, voucherCovers, voucherState } from "@/lib/actions";
import { BUSINESS, addDays, atTime, dateKey, fromDateKey, minutesOfDay, pad, remaining, staffColor, time } from "@/lib/format";
import type { Row } from "@/lib/store";
import type { Booking, BookingRequest, DayHours, Staff, Voucher } from "@/lib/types";
import { RequestsSheet, usePendingRequests } from "@/components/RequestsSheet";
import { DatePicker } from "@/components/DatePicker";
import { QueryAction } from "@/components/QueryAction";
import { ReminderSheet, useReminders } from "@/components/ReminderSheet";
import { dayWord } from "@/lib/reminders";
import { dot, fromMin, hoursOn, shiftOn, toMin, useSettings, useTeam } from "@/lib/settings";

const HOUR = 88; // px per hour
const SNAP = 15;
/** Hours shown after closing, so the desk can book overtime sessions. */
const OVERTIME_HOURS = 2;

type View = "jadwal" | "daftar";
const VIEW_KEY = "jade-physio-kalender-view";

export default function KalenderPage() {
  const [day, setDay] = useState(dateKey());
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [view, setViewState] = useState<View>("jadwal");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_KEY);
      // Phones: the list reads better than narrow columns unless the grid was picked before.
      if (saved === "daftar" || (!saved && window.innerWidth < 768)) setViewState("daftar");
    } catch {
      /* ignore */
    }
  }, []);
  const setView = (v: View) => {
    setViewState(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };
  const now = useNow();
  const today = dateKey(now);
  const { staff, loading: staffLoading } = useStaff();
  const { customers } = useCustomers();
  const { rows: bookingRows, loading } = useCollection<Booking>("bookings", [["dateKey", "==", day]]);
  const { rows: activeVouchers } = useCollection<Voucher>("vouchers", [["status", "==", "active"]]);
  const { settings } = useSettings();
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [remindOpen, setRemindOpen] = useState(false);
  const [requestFocus, setRequestFocus] = useState<string | null>(null);
  const { team } = useTeam();
  const dayHours = hoursOn(settings, day);
  // Each physio's shift that day, when the admin has set one (undefined = no schedule kept).
  const shifts = useMemo(() => {
    const m = new Map<string, DayHours | null>();
    for (const t of team) if (t.staffId && t.schedule && Object.keys(t.schedule).length) m.set(t.staffId, shiftOn(t, day));
    return m;
  }, [team, day]);

  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [notLinkedSeen, setNotLinkedSeen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const toast = useToast();
  const user = useUser();
  const can = useCan();
  const manage = can("bookings.manage");
  const remindDay = day > today ? day : addDays(today, 1);
  const isTherapist = user.role === "therapist";
  const [mineOnly, setMineOnly] = useState(true);
  const linked = isTherapist && !!user.staffId && staff.some((s) => s.id === user.staffId);
  const onlyMine = linked && mineOnly;
  const columns = onlyMine ? staff.filter((s) => s.id === user.staffId) : staff;

  const bookings = useMemo(
    () =>
      (bookingRows ?? [])
        .filter((b) => b.status !== "cancelled" && (!onlyMine || b.staffId === user.staffId))
        .sort((a, b) => a.startAt - b.startAt),
    [bookingRows, onlyMine, user.staffId],
  );
  const selected = (bookingRows ?? []).find((b) => b.id === selectedId) ?? null;

  const voucherFor = useMemo(() => {
    const byCustomer = new Map<string, Row<Voucher>[]>();
    for (const v of activeVouchers ?? []) {
      if (voucherState(v) !== "active") continue;
      byCustomer.set(v.customerId, [...(byCustomer.get(v.customerId) ?? []), v]);
    }
    return (b: Booking) => (byCustomer.get(b.customerId) ?? []).find((v) => voucherCovers(v, b.serviceId));
  }, [activeVouchers]);

  const counts = useMemo(() => {
    const c = { booked: 0, in_session: 0, paid: 0 };
    for (const b of bookings) if (b.status in c) c[b.status as keyof typeof c]++;
    return c;
  }, [bookings]);

  const openNew = (d: BookingDraft = {}) => setDraft(d);
  const openEdit = (b: Row<Booking>) => {
    setSelectedId(null);
    setDraft({
      id: b.id,
      customer: customers.find((c) => c.id === b.customerId) ?? {
        id: b.customerId,
        name: b.customerName,
        nameLower: b.customerName.toLowerCase(),
        phone: b.customerPhone ?? "",
        createdAt: 0,
      },
      staffId: b.staffId,
      serviceId: b.serviceId,
      packageId: b.packageId ?? undefined,
      voucherId: b.voucherId ?? undefined,
      startAt: b.startAt,
      durationMin: b.durationMin,
      notes: b.notes,
    });
  };

  const dateObj = fromDateKey(day);
  const weekday = dateObj.toLocaleDateString("id-ID", { weekday: "long" });
  const dateLabel = dateObj.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const relative = day === today ? "Hari ini" : day === addDays(today, 1) ? "Besok" : day === addDays(today, -1) ? "Kemarin" : null;

  const noSetup = !staffLoading && staff.length === 0;

  return (
    <div className="flex h-[calc(100dvh-72px-var(--safe-bottom))] flex-col md:h-dvh">
      {/* Header */}
      <header className="border-b border-line bg-surface px-4 pt-4 pb-3 md:px-8 md:pt-6 md:pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconButton label="Hari sebelumnya" onClick={() => setDay(addDays(day, -1))}>
              <ChevronLeft className="size-5" />
            </IconButton>
            <DatePicker value={day} onChange={setDay} marks={{ col: "bookings", skip: (b) => b.status === "cancelled" }}>
              <span className="block min-w-0">
                <span className="flex items-center gap-1 text-[13px] font-semibold text-jade">
                  {relative ?? weekday}
                  <CalendarDays className="size-3.5" />
                </span>
                <span className="block text-[17px] leading-tight font-bold tracking-[-0.01em] md:text-[22px]">
                  {relative ? `${weekday}, ${dateLabel}` : dateLabel}
                </span>
              </span>
            </DatePicker>
            <IconButton label="Hari berikutnya" onClick={() => setDay(addDays(day, 1))}>
              <ChevronRight className="size-5" />
            </IconButton>
            {day !== today && (
              <Button size="sm" variant="secondary" onClick={() => setDay(today)} className="ml-1">
                Hari ini
              </Button>
            )}
          </div>
          <div className="hidden items-center gap-2 md:flex">
            {can("requests.manage") && <RequestsButton onClick={() => (setRequestFocus(null), setRequestsOpen(true))} />}
            {manage && <RemindButton day={remindDay} onClick={() => setRemindOpen(true)} />}
            {linked && <MineToggle mine={mineOnly} setMine={setMineOnly} />}
            <ViewToggle view={view} setView={setView} />
            {manage && (
              <Button icon={<Plus className="size-4" />} onClick={() => openNew(slotDraft(day))}>
                Booking baru
              </Button>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 md:hidden">
          {can("requests.manage") && <RequestsButton onClick={() => (setRequestFocus(null), setRequestsOpen(true))} />}
          {manage && <RemindButton day={remindDay} onClick={() => setRemindOpen(true)} />}
          {linked && <MineToggle mine={mineOnly} setMine={setMineOnly} />}
          <ViewToggle view={view} setView={setView} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
          <Stat label="booking" value={bookings.length} />
          <Stat label="sedang sesi" value={counts.in_session} tone="amber" />
          <Stat label="menunggu" value={counts.booked} />
          <Stat label="lunas" value={counts.paid} tone="jade" />
          <span className="inline-flex h-7 shrink-0 items-center rounded-full border border-line px-3 font-medium text-ink-2">
            {dayHours ? `Buka ${dot(dayHours.start)}–${dot(dayHours.end)}` : "Klinik tutup"}
          </span>
        </div>
      </header>

      {noSetup ? (
        <Empty
          icon={<Sparkles className="size-5" />}
          title="Belum ada terapis dan layanan"
          body={
            can("catalog")
              ? "Tambahkan terapis di menu Terapis & akses dan layanan di Katalog, atau isi contoh awal untuk mulai mencoba."
              : "Minta admin menambahkan terapis dan layanan terlebih dahulu."
          }
          action={
            can("catalog") && (
            <Button
              loading={seeding}
              onClick={async () => {
                setSeeding(true);
                try {
                  await seedCatalog();
                  toast("Contoh terapis, layanan, dan paket ditambahkan");
                } catch (e) {
                  toast(errorText(e), "error");
                } finally {
                  setSeeding(false);
                }
              }}
            >
              Isi contoh awal
            </Button>
            )
          }
        />
      ) : loading || staffLoading ? (
        <Spinner />
      ) : isTherapist && !linked && view === "jadwal" && staff.length > 0 && !notLinkedSeen ? (
        <div className="px-4 pt-4 md:px-8">
          <p className="rounded-xl bg-amber-mist px-4 py-3 text-sm text-amber">
            Akun Anda belum dihubungkan ke kolom terapis. Minta admin mengaturnya di menu Terapis &amp; akses. Sementara ini
            Anda melihat jadwal semua terapis.
          </p>
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => setNotLinkedSeen(true)}>
            Lihat jadwal
          </Button>
        </div>
      ) : view === "jadwal" ? (
        <Timeline
          day={day}
          now={now}
          isToday={day === today}
          staff={columns}
          clinic={dayHours}
          shifts={shifts}
          bookings={bookings}
          compact={!isDesktop}
          voucherFor={voucherFor}
          onSlot={manage ? (staffId, startAt) => openNew({ staffId, startAt }) : undefined}
          onOpen={(b) => setSelectedId(b.id)}
          showRequests={can("requests.manage")}
          onRequest={(id) => (setRequestFocus(id), setRequestsOpen(true))}
        />
      ) : (
        <ListView bookings={bookings} staff={staff} voucherFor={voucherFor} onOpen={(b) => setSelectedId(b.id)} />
      )}

      {manage && <QueryAction name="baru" run={() => openNew(slotDraft(day))} />}
      {manage && <QueryAction name="pengingat" run={() => setRemindOpen(true)} />}
      {/* Phone: floating action */}
      {!noSetup && manage && (
        <Fab label="Booking baru" text="Booking" icon={<Plus className="size-5" />} onClick={() => openNew(slotDraft(day))} />
      )}

      <BookingSheet open={!!draft} draft={draft} onClose={() => setDraft(null)} />
      {can("requests.manage") && <RequestsSheet open={requestsOpen} focusId={requestFocus} onClose={() => setRequestsOpen(false)} />}
      {manage && <ReminderSheet open={remindOpen} initialDay={remindDay} onClose={() => setRemindOpen(false)} />}
      {selected && <BookingDetail booking={selected} staff={staff} onClose={() => setSelectedId(null)} onEdit={openEdit} />}
    </div>
  );
}

/** Reminders for the shown day when it is ahead, otherwise for tomorrow. */
function RemindButton({ day, onClick }: { day: string; onClick: () => void }) {
  const { open } = useReminders(day);
  return (
    <Button size="sm" variant="secondary" icon={<BellRing className="size-3.5" />} onClick={onClick} title={`Ingatkan pasien ${dayWord(day)}`}>
      Pengingat{open ? ` (${open})` : ""}
    </Button>
  );
}

function RequestsButton({ onClick }: { onClick: () => void }) {
  const n = usePendingRequests().length;
  return (
    <Button size="sm" variant={n ? "primary" : "secondary"} icon={<Globe className="size-3.5" />} onClick={onClick}>
      Permintaan{n ? ` (${n})` : ""}
    </Button>
  );
}

function slotDraft(day: string): BookingDraft {
  if (day === dateKey()) return {};
  return { startAt: atTime(day, "09:00") };
}

function MineToggle({ mine, setMine }: { mine: boolean; setMine: (v: boolean) => void }) {
  return (
    <Segmented
      size="sm"
      value={mine ? "mine" : "all"}
      onChange={(v) => setMine(v === "mine")}
      options={[
        { value: "mine", label: "Jadwal saya" },
        { value: "all", label: "Semua" },
      ]}
    />
  );
}

function ViewToggle({ view, setView }: { view: View; setView: (v: View) => void }) {
  return (
    <Segmented
      size="sm"
      value={view}
      onChange={setView}
      options={[
        { value: "jadwal", label: "Jadwal" },
        { value: "daftar", label: "Daftar" },
      ]}
    />
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "amber" | "jade" }) {
  return (
    <span
      className={cx(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 font-medium",
        tone === "amber" ? "bg-amber-mist text-amber" : tone === "jade" ? "bg-jade-mist text-jade-deep" : "bg-line-soft text-ink-2",
      )}
    >
      {tone === "amber" && value > 0 && <span className="pulse-dot size-1.5 rounded-full bg-amber" />}
      <span className="tnum font-bold">{value}</span>
      {label}
    </span>
  );
}

/* ---------------- Timeline ---------------- */

interface Placed {
  b: Row<Booking>;
  lane: number;
  lanes: number;
}

/** Side-by-side lanes for bookings that overlap within one therapist column. */
function layoutLanes(list: Row<Booking>[]): Placed[] {
  const sorted = [...list].sort((a, b) => a.startAt - b.startAt || b.durationMin - a.durationMin);
  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = 0;
  let laneEnds: number[] = [];
  const flush = () => {
    const n = laneEnds.length;
    cluster.forEach((p) => (p.lanes = n));
    out.push(...cluster);
    cluster = [];
    laneEnds = [];
  };
  for (const b of sorted) {
    const end = b.startAt + b.durationMin * 60_000;
    if (cluster.length && b.startAt >= clusterEnd) flush();
    let lane = laneEnds.findIndex((e) => e <= b.startAt);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else laneEnds[lane] = end;
    cluster.push({ b, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();
  return out;
}

function Timeline({
  day,
  now,
  isToday,
  staff,
  clinic,
  shifts,
  bookings,
  compact,
  voucherFor,
  onSlot,
  onOpen,
  showRequests,
  onRequest,
}: {
  /** Draw this day's pending portal requests (front desk only). */
  showRequests?: boolean;
  onRequest?: (id: string) => void;
  day: string;
  now: number;
  isToday: boolean;
  staff: Row<Staff>[];
  clinic: DayHours | null;
  shifts: Map<string, DayHours | null>;
  bookings: Row<Booking>[];
  compact: boolean;
  voucherFor: (b: Booking) => Row<Voucher> | undefined;
  onSlot?: (staffId: string, startAt: number) => void;
  onOpen: (b: Row<Booking>) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ staffId: string; min: number } | null>(null);
  const pending = usePendingRequests(!!showRequests);
  const dayRequests = pending.filter((r) => r.dateKey === day);
  // The clinic's hours that day plus room for overtime after closing, widened if bookings fall outside them.
  const openMin = clinic ? toMin(clinic.start) : BUSINESS.openHour * 60;
  const closeMin = clinic ? toMin(clinic.end) : BUSINESS.closeHour * 60;
  const open = Math.min(Math.floor(openMin / 60), ...bookings.map((b) => Math.floor(minutesOfDay(b.startAt) / 60)));
  const close = Math.max(
    clinic ? Math.min(24, Math.ceil(closeMin / 60) + OVERTIME_HOURS) : Math.ceil(closeMin / 60),
    ...bookings.map((b) => Math.ceil((minutesOfDay(b.startAt) + b.durationMin) / 60)),
  );
  const yOf = (min: number) => ((min - open * 60) / 60) * HOUR;
  const hours = Array.from({ length: close - open }, (_, i) => open + i);
  const heightPx = hours.length * HOUR;
  const nowMin = minutesOfDay(now);
  const nowTop = ((nowMin - open * 60) / 60) * HOUR;
  const showNow = isToday && nowMin >= open * 60 && nowMin <= close * 60;
  const gutter = compact ? 44 : 60;

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const target = isToday ? nowTop - 120 : ((9 - open) * HOUR) - 16;
    el.scrollTop = Math.max(0, target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  const byStaff = useMemo(() => {
    const m = new Map<string, Placed[]>();
    for (const s of staff) m.set(s.id, layoutLanes(bookings.filter((b) => b.staffId === s.id)));
    return m;
  }, [staff, bookings]);

  const slotAt = (e: React.MouseEvent<HTMLDivElement>) => {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    return open * 60 + Math.floor(((y / HOUR) * 60) / SNAP) * SNAP;
  };

  function handleColumnClick(e: React.MouseEvent<HTMLDivElement>, staffId: string) {
    if (!onSlot || e.target !== e.currentTarget) return;
    const min = slotAt(e);
    onSlot(staffId, atTime(day, `${pad(Math.floor(min / 60))}:${pad(min % 60)}`));
  }

  /** Highlight the 15-minute cell under the mouse, only over empty space. */
  function handleHover(e: React.MouseEvent<HTMLDivElement>, staffId: string) {
    if (!onSlot || e.target !== e.currentTarget) return setHover(null);
    const min = slotAt(e);
    if (hover?.staffId !== staffId || hover.min !== min) setHover({ staffId, min });
  }

  return (
    <div ref={scroller} className="scroll-thin relative flex-1 overflow-auto bg-surface">
      <div className="min-w-max" style={{ ["--hour" as string]: `${HOUR}px` }}>
        {/* Therapist header row */}
        <div className="sticky top-0 z-20 flex border-b border-line bg-surface">
          <div className="sticky left-0 z-10 shrink-0 bg-surface" style={{ width: gutter }} />
          {staff.map((s) => {
            const c = staffColor(s.color);
            const mine = bookings.filter((b) => b.staffId === s.id);
            const active = mine.filter((b) => b.status === "in_session").length;
            return (
              <div
                key={s.id}
                className="flex min-w-[168px] flex-1 items-center gap-2.5 border-l border-line-soft px-3 py-2.5 md:min-w-[200px]"
              >
                {compact ? (
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.dot }} />
                ) : (
                  <Avatar name={s.name.replace(/^Ft\.\s*/, "")} color={c} size={34} />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{s.name}</p>
                  <p className="truncate text-xs whitespace-nowrap text-muted">
                    <span className="tnum">{mine.length}</span> pasien
                    {active > 0 && (
                      <span className="ml-1.5 font-semibold text-amber">
                        <span className="tnum">{active}</span> sesi
                      </span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="relative flex">
          {/* Hour gutter */}
          <div className="sticky left-0 z-10 shrink-0 border-r border-line-soft bg-surface" style={{ width: gutter, height: heightPx }}>
            {hours.map((h, i) => (
              <span
                key={h}
                className="tnum absolute right-2 -translate-y-1/2 text-[11px] font-medium text-muted md:text-xs"
                style={{ top: i * HOUR }}
              >
                {i === 0 || (showNow && Math.abs(nowMin - h * 60) < 14) ? "" : `${pad(h)}.00`}
              </span>
            ))}
            {showNow && (
              <span
                className="tnum absolute right-1 z-10 -translate-y-1/2 rounded-md bg-jade-deep px-1 py-0.5 text-[10px] font-bold text-white md:text-[11px]"
                style={{ top: nowTop }}
              >
                {time(now)}
              </span>
            )}
          </div>

          {staff.map((s) => {
            const shift = shifts.get(s.id);
            const hasSchedule = shifts.has(s.id);
            // Grey out the time this physio isn't working, and when the clinic is closed.
            const off: [number, number, string][] = [];
            const dayStart = open * 60;
            const dayEnd = close * 60;
            if (!clinic) off.push([dayStart, dayEnd, "Klinik tutup"]);
            else if (hasSchedule && !shift) off.push([dayStart, dayEnd, "Libur"]);
            else {
              const from = Math.max(openMin, shift ? toMin(shift.start) : openMin);
              const to = Math.min(closeMin, shift ? toMin(shift.end) : closeMin);
              if (from > dayStart) off.push([dayStart, from, shift ? "Belum masuk shift" : "Belum buka"]);
              if (to < closeMin) off.push([to, closeMin, "Selesai shift"]);
              // After closing is still bookable, for overtime sessions.
              if (closeMin < dayEnd) off.push([closeMin, dayEnd, "Lembur"]);
            }
            return (
            <div
              key={s.id}
              onClick={(e) => handleColumnClick(e, s.id)}
              onMouseMove={(e) => handleHover(e, s.id)}
              onMouseLeave={() => setHover(null)}
              className={cx("cal-grid relative min-w-[168px] flex-1 border-l border-line-soft md:min-w-[200px]", onSlot && "cursor-cell")}
              style={{ height: heightPx }}
            >
              {off.map(([a, b, label]) => (
                <div
                  key={a}
                  className="off-hours pointer-events-none absolute inset-x-0 flex items-start justify-center"
                  style={{ top: yOf(a), height: yOf(b) - yOf(a) }}
                >
                  {yOf(b) - yOf(a) > 40 && <span className="mt-1.5 rounded-full bg-surface/90 px-2 py-0.5 text-[11px] font-semibold text-muted">{label}</span>}
                </div>
              ))}
              {dayRequests
                .filter((r) => (r.staffId ?? staff[0]?.id) === s.id)
                .map((r) => (
                  <RequestBlock key={r.id} r={r} top={yOf(minutesOfDay(r.startAt))} anyone={!r.staffId} onOpen={() => onRequest?.(r.id)} />
                ))}
              {hover?.staffId === s.id && (
                <div
                  className="pointer-events-none absolute inset-x-1 z-[1] flex items-center rounded-md border border-jade/60 bg-jade-mist/80 px-2 text-[11px] font-bold text-jade-deep"
                  style={{ top: yOf(hover.min) + 1, height: (SNAP / 60) * HOUR - 2 }}
                >
                  <Plus className="mr-1 size-3" />
                  {dot(fromMin(hover.min))} {s.name}
                </div>
              )}
              {(byStaff.get(s.id) ?? []).map((p) => (
                <BookingBlock
                  key={p.b.id}
                  placed={p}
                  open={open}
                  color={s.color}
                  hasVoucher={!!voucherFor(p.b)}
                  onOpen={onOpen}
                />
              ))}
            </div>
            );
          })}

          {showNow && (
            <div className="pointer-events-none absolute right-0 z-[5] h-0 border-t-2 border-jade-deep" style={{ top: nowTop, left: gutter }}>
              <span className="absolute -top-[5px] -left-[5px] size-2 rounded-full bg-jade-deep" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** A patient's portal request, not yet confirmed: dashed, so it reads as tentative. */
function RequestBlock({ r, top, anyone, onOpen }: { r: Row<BookingRequest>; top: number; anyone: boolean; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="absolute right-[3px] left-[3px] z-[2] overflow-hidden rounded-lg border-2 border-dashed border-jade bg-surface/90 px-2 py-1 text-left text-jade-deep hover:shadow-[var(--shadow-lift)]"
      style={{ top: top + 1, height: Math.max((r.durationMin / 60) * HOUR - 3, 26) }}
    >
      <span className="flex items-center gap-1 text-[12px] font-bold">
        <Globe className="size-3 shrink-0" />
        <span className="truncate">{r.personName}</span>
      </span>
      <span className="block truncate text-[11px] opacity-80">Permintaan online{anyone ? ", terapis bebas" : ""}</span>
    </button>
  );
}

function BookingBlock({
  placed,
  open,
  color,
  hasVoucher,
  onOpen,
}: {
  placed: Placed;
  open: number;
  color: string;
  hasVoucher: boolean;
  onOpen: (b: Row<Booking>) => void;
}) {
  const { b, lane, lanes } = placed;
  const c = staffColor(color);
  const top = ((minutesOfDay(b.startAt) - open * 60) / 60) * HOUR;
  const height = Math.max((b.durationMin / 60) * HOUR - 3, 26);
  const width = 100 / lanes;
  const short = height < 50;
  const inSession = b.status === "in_session";
  const paid = b.status === "paid";

  return (
    <button
      onClick={() => onOpen(b)}
      className={cx(
        "group absolute overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-left transition-shadow hover:z-10 hover:shadow-[var(--shadow-lift)]",
        paid && "hatch",
      )}
      style={{
        top: top + 1,
        height,
        left: `calc(${lane * width}% + 3px)`,
        width: `calc(${width}% - 6px)`,
        background: inSession ? c.solid : c.bg,
        borderLeftColor: inSession ? c.fg : c.dot,
        color: inSession ? "#fff" : c.fg,
        opacity: paid ? 0.72 : 1,
      }}
    >
      <span className="flex items-center gap-1">
        {inSession && <span className="pulse-dot size-1.5 shrink-0 rounded-full bg-white" />}
        {paid && <Check className="size-3 shrink-0" strokeWidth={3} />}
        <span className={cx("text-[13px] leading-tight font-bold", lanes > 1 && !short ? "line-clamp-2 break-words" : "truncate")}>
          {b.customerName}
        </span>
        {hasVoucher && !paid && <Ticket className="ml-auto size-3 shrink-0 opacity-80" aria-label="Punya voucher" />}
      </span>
      {!short && (
        <>
          <span className="mt-0.5 block truncate text-xs leading-tight opacity-90">{b.serviceName}</span>
          <span className="tnum mt-0.5 block text-[11px] leading-tight opacity-90">
            {time(b.startAt)}–{time(b.startAt + b.durationMin * 60_000)}
          </span>
        </>
      )}
    </button>
  );
}

/* ---------------- List view ---------------- */

function ListView({
  bookings,
  staff,
  voucherFor,
  onOpen,
}: {
  bookings: Row<Booking>[];
  staff: Row<Staff>[];
  voucherFor: (b: Booking) => Row<Voucher> | undefined;
  onOpen: (b: Row<Booking>) => void;
}) {
  const groups: { title: string; items: Row<Booking>[] }[] = [
    { title: "Sedang sesi", items: bookings.filter((b) => b.status === "in_session") },
    { title: "Menunggu", items: bookings.filter((b) => b.status === "booked") },
    { title: "Lunas", items: bookings.filter((b) => b.status === "paid") },
  ];
  if (bookings.length === 0)
    return (
      <div className="flex-1 overflow-y-auto">
        <Empty icon={<CalendarDays className="size-5" />} title="Belum ada booking di hari ini" body="Tekan Booking untuk mencatat pasien walk-in atau janji temu." />
      </div>
    );
  return (
    <div className="scroll-thin flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {groups
          .filter((g) => g.items.length)
          .map((g) => (
            <section key={g.title}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-2">
                {g.title}
                <span className="tnum rounded-full bg-line-soft px-2 text-xs">{g.items.length}</span>
              </h2>
              <div className="overflow-hidden rounded-xl border border-line bg-surface">
                {g.items.map((b, i) => (
                  <ListRow key={b.id} b={b} staff={staff} voucher={voucherFor(b)} onOpen={onOpen} first={i === 0} />
                ))}
              </div>
            </section>
          ))}
      </div>
    </div>
  );
}

function ListRow({
  b,
  staff,
  voucher,
  onOpen,
  first,
}: {
  b: Row<Booking>;
  staff: Row<Staff>[];
  voucher?: Row<Voucher>;
  onOpen: (b: Row<Booking>) => void;
  first: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const user = useUser();
  const can = useCan();
  const st = staff.find((s) => s.id === b.staffId);
  const c = staffColor(st?.color);
  return (
    <div className={cx("flex items-center gap-3 px-3 py-3 md:px-4", !first && "border-t border-line-soft")}>
      <button onClick={() => onOpen(b)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="tnum w-12 shrink-0 text-sm">
          <p className="font-bold">{time(b.startAt)}</p>
          <p className="text-xs text-muted">{time(b.startAt + b.durationMin * 60_000)}</p>
        </div>
        <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: c.dot }} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{b.customerName}</p>
          <p className="truncate text-[13px] text-muted">
            {b.serviceName}
            <span className="mx-1.5 text-line">|</span>
            {b.staffName}
          </p>
          {voucher && b.status !== "paid" && (
            <p className="mt-0.5 text-xs font-semibold text-jade-deep">Voucher: sisa {remaining(voucher)} sesi</p>
          )}
        </div>
      </button>
      <div className="shrink-0">
        {b.status === "booked" && canRunSession(user, b) && (
          <Button
            size="sm"
            variant="secondary"
            icon={<Play className="size-3.5" />}
            onClick={async () => {
              try {
                await setBookingStatus(b.id, "in_session");
                toast(`Sesi ${b.customerName} dimulai`);
              } catch (e) {
                toast(errorText(e), "error");
              }
            }}
          >
            Mulai
          </Button>
        )}
        {b.status === "in_session" &&
          (can("checkout") ? (
            <Button size="sm" onClick={() => router.push(`/checkout?booking=${b.id}`)}>
              Checkout
            </Button>
          ) : (
            <StatusBadge status="in_session" />
          ))}
        {b.status === "paid" && <StatusBadge status="paid" />}
      </div>
    </div>
  );
}
