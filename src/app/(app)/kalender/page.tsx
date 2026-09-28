"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Play, Plus, Sparkles, Ticket } from "lucide-react";
import { Avatar, Button, Empty, IconButton, Segmented, Spinner, cx, errorText, useToast } from "@/components/ui";
import { BookingSheet, type BookingDraft } from "@/components/BookingSheet";
import { BookingDetail, StatusBadge } from "@/components/BookingDetail";
import { useCollection, useCustomers, useMediaQuery, useNow, useStaff } from "@/lib/hooks";
import { useCan, useUser } from "@/lib/auth";
import { canRunSession } from "@/lib/roles";
import { seedCatalog, setBookingStatus, voucherCovers, voucherState } from "@/lib/actions";
import { BUSINESS, addDays, atTime, dateKey, fromDateKey, minutesOfDay, pad, remaining, staffColor, time } from "@/lib/format";
import type { Row } from "@/lib/store";
import type { Booking, Staff, Voucher } from "@/lib/types";

const HOUR = 88; // px per hour
const SNAP = 15;

type View = "jadwal" | "daftar";

export default function KalenderPage() {
  const [day, setDay] = useState(dateKey());
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [view, setView] = useState<View>("jadwal");
  const now = useNow();
  const today = dateKey(now);
  const { staff, loading: staffLoading } = useStaff();
  const { customers } = useCustomers();
  const { rows: bookingRows, loading } = useCollection<Booking>("bookings", [["dateKey", "==", day]]);
  const { rows: activeVouchers } = useCollection<Voucher>("vouchers", [["status", "==", "active"]]);

  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [notLinkedSeen, setNotLinkedSeen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const toast = useToast();
  const user = useUser();
  const can = useCan();
  const manage = can("bookings.manage");
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
            <label className="relative cursor-pointer">
              <span className="block min-w-0">
                <span className="block text-[13px] font-semibold text-jade">{relative ?? weekday}</span>
                <span className="block text-[17px] leading-tight font-bold tracking-[-0.01em] md:text-[22px]">
                  {relative ? `${weekday}, ${dateLabel}` : dateLabel}
                </span>
              </span>
              <input
                type="date"
                aria-label="Pilih tanggal"
                value={day}
                onChange={(e) => e.target.value && setDay(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
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
            {linked && <MineToggle mine={mineOnly} setMine={setMineOnly} />}
            <ViewToggle view={view} setView={setView} />
            {manage && (
              <Button icon={<Plus className="size-4" />} onClick={() => openNew(slotDraft(day))}>
                Booking baru
              </Button>
            )}
          </div>
        </div>
        <div className="no-scrollbar -mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 text-[13px] md:mx-0 md:px-0">
          <div className="flex shrink-0 gap-2 md:hidden">
            {linked && <MineToggle mine={mineOnly} setMine={setMineOnly} />}
            <ViewToggle view={view} setView={setView} />
          </div>
          <Stat label="booking" value={bookings.length} />
          <Stat label="sedang sesi" value={counts.in_session} tone="amber" />
          <Stat label="menunggu" value={counts.booked} />
          <Stat label="lunas" value={counts.paid} tone="jade" />
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
          bookings={bookings}
          compact={!isDesktop}
          voucherFor={voucherFor}
          onSlot={manage ? (staffId, startAt) => openNew({ staffId, startAt }) : undefined}
          onOpen={(b) => setSelectedId(b.id)}
        />
      ) : (
        <ListView bookings={bookings} staff={staff} voucherFor={voucherFor} onOpen={(b) => setSelectedId(b.id)} />
      )}

      {/* Phone: floating action */}
      {!noSetup && manage && (
        <button
          onClick={() => openNew(slotDraft(day))}
          aria-label="Booking baru"
          className="fixed right-4 bottom-[calc(84px+var(--safe-bottom))] z-20 flex h-14 items-center gap-2 rounded-2xl bg-jade px-5 font-semibold text-white shadow-[var(--shadow-lift)] active:bg-jade-deep md:hidden"
        >
          <Plus className="size-5" />
          Booking
        </button>
      )}

      <BookingSheet open={!!draft} draft={draft} onClose={() => setDraft(null)} />
      {selected && <BookingDetail booking={selected} staff={staff} onClose={() => setSelectedId(null)} onEdit={openEdit} />}
    </div>
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
  bookings,
  compact,
  voucherFor,
  onSlot,
  onOpen,
}: {
  day: string;
  now: number;
  isToday: boolean;
  staff: Row<Staff>[];
  bookings: Row<Booking>[];
  compact: boolean;
  voucherFor: (b: Booking) => Row<Voucher> | undefined;
  onSlot?: (staffId: string, startAt: number) => void;
  onOpen: (b: Row<Booking>) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  // Widen the day if bookings fall outside opening hours.
  const open = Math.min(BUSINESS.openHour, ...bookings.map((b) => Math.floor(minutesOfDay(b.startAt) / 60)));
  const close = Math.max(
    BUSINESS.closeHour,
    ...bookings.map((b) => Math.ceil((minutesOfDay(b.startAt) + b.durationMin) / 60)),
  );
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

  function handleColumnClick(e: React.MouseEvent<HTMLDivElement>, staffId: string) {
    if (!onSlot || e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const min = open * 60 + Math.floor(((y / HOUR) * 60) / SNAP) * SNAP;
    onSlot(staffId, atTime(day, `${pad(Math.floor(min / 60))}:${pad(min % 60)}`));
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

          {staff.map((s) => (
            <div
              key={s.id}
              onClick={(e) => handleColumnClick(e, s.id)}
              className={cx("cal-grid relative min-w-[168px] flex-1 border-l border-line-soft md:min-w-[200px]", onSlot && "cursor-cell")}
              style={{ height: heightPx }}
            >
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
          ))}

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
        background: inSession ? c.dot : c.bg,
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
          <span className="mt-0.5 block truncate text-xs leading-tight opacity-85">{b.serviceName}</span>
          <span className="tnum mt-0.5 block text-[11px] leading-tight opacity-75">
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
