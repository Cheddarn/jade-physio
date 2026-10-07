"use client";

import { Pager, usePager } from "@/components/Pager";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BedDouble,
  CalendarCheck,
  Clock,
  FileText,
  Globe,
  PackagePlus,
  ReceiptText,
  Ticket,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { Card, PageHeader, Segmented, Spinner, cx } from "@/components/ui";
import { useCollection, useNow, useStaff } from "@/lib/hooks";
import { voucherState } from "@/lib/actions";
import { addDays, dateKey, num, rupiah, rupiahShort, shortDate, staffColor, time } from "@/lib/format";
import { durationText, useSettings } from "@/lib/settings";
import { peopleText } from "@/lib/flow";
import type { Row } from "@/lib/store";
import type { Attendance, Booking, BookingRequest, RestockItem, Sale, TherapyReport, Visit, Voucher } from "@/lib/types";

type Range = "today" | "7d" | "month";
type Kind = "pasien" | "uang" | "tim" | "laporan" | "restock" | "online";

interface Event {
  at: number;
  kind: Kind;
  text: string;
  icon: LucideIcon;
  tone?: "amber" | "jade" | "danger";
}

const KIND_LABEL: Record<Kind, string> = {
  pasien: "Pasien",
  uang: "Transaksi",
  tim: "Absen",
  laporan: "Laporan",
  restock: "Restock",
  online: "Booking online",
};

/** Supervisor's view: what happened at the clinic, from every part of the system. */
export default function RingkasanPage() {
  const now = useNow(60_000);
  const today = dateKey(now);
  const [range, setRange] = useState<Range>("today");
  const [only, setOnly] = useState<Kind | "all">("all");
  const from = range === "today" ? today : range === "7d" ? addDays(today, -6) : `${today.slice(0, 7)}-01`;
  const span: [string, "<=" | ">=", string][] = [
    ["dateKey", ">=", from],
    ["dateKey", "<=", today],
  ];
  const { staff } = useStaff(true);
  const { settings } = useSettings();
  const visits = useCollection<Visit>("visits", span).rows;
  const bookings = useCollection<Booking>("bookings", span).rows;
  const sales = useCollection<Sale>("sales", span).rows;
  const reports = useCollection<TherapyReport>("reports", span).rows;
  const restock = useCollection<RestockItem>("restock", span).rows;
  const openRestock = useCollection<RestockItem>("restock", [["done", "==", false]]).rows;
  const attendance = useCollection<Attendance>("attendance", span).rows;
  const pending = useCollection<BookingRequest>("requests", [["status", "==", "pending"]]).rows;
  const fromMs = new Date(`${from}T00:00:00`).getTime();
  const requests = useCollection<BookingRequest>("requests", [["createdAt", ">=", fromMs]]).rows;
  const vouchers = useCollection<Voucher>("vouchers", [["status", "==", "active"]]).rows;

  const inRange = <T extends { dateKey: string }>(rows: Row<T>[] | null) => (rows ?? []).filter((r) => r.dateKey >= from && r.dateKey <= today);
  const V = inRange(visits);
  const B = inRange(bookings).filter((b) => b.status !== "cancelled");
  const S = inRange(sales);
  const R = inRange(reports);
  const RS = inRange(restock);
  const A = inRange(attendance);
  const paidSales = S.filter((s) => s.status === "paid");

  const stats = useMemo(() => {
    const waits = V.filter((v) => v.startedAt).map((v) => (v.startedAt! - v.arrivedAt) / 60_000);
    const due = B.filter((b) => b.status === "paid" || V.some((v) => v.bookingId === b.id && v.stage === "finished"));
    const pkgs = paidSales.flatMap((s) => s.items.filter((i) => i.kind === "package"));
    const until = now + settings.reminderDays * 86_400_000;
    return {
      walkIns: V.length,
      people: V.reduce((n, v) => n + (v.peopleL || 0) + (v.peopleP || 0), 0),
      inClinic: (visits ?? []).filter((v) => v.dateKey === today && !v.closedAt && v.stage !== "cancelled").length,
      avgWait: waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0,
      sessions: B.filter((b) => b.status === "paid" || b.status === "in_session").length,
      cancelled: inRange(bookings).filter((b) => b.status === "cancelled").length,
      revenue: paidSales.reduce((n, s) => n + s.total, 0),
      invoices: paidSales.length,
      pkgCount: pkgs.reduce((n, i) => n + i.qty, 0),
      pkgValue: pkgs.reduce((n, i) => n + i.amount, 0),
      reportsDue: due.length,
      reportsDone: due.filter((b) => R.some((r) => r.bookingId === b.id)).length,
      reportsUnsent: R.filter((r) => !r.sentAt).length,
      overtime: A.reduce((n, a) => n + (a.overtimeMin || 0), 0),
      overtimeDays: A.filter((a) => a.closing === "overtime").length,
      present: (attendance ?? []).filter((a) => a.dateKey === today).length,
      notOut: (attendance ?? []).filter((a) => a.dateKey < today && !a.outAt).length,
      restockOpen: (openRestock ?? []).length,
      restockUrgent: (openRestock ?? []).filter((r) => r.urgent).length,
      restockNew: RS.length,
      requestsPending: (pending ?? []).length,
      requestsNew: (requests ?? []).length,
      expiring: (vouchers ?? []).filter((v) => voucherState(v) === "active" && v.expiresAt != null && v.expiresAt <= until).length,
    };
  }, [V, B, R, RS, A, paidSales, visits, bookings, attendance, openRestock, pending, requests, vouchers, settings.reminderDays, now, today]);

  // Per physio: sessions, reports, overtime.
  const perStaff = useMemo(() => {
    return staff
      .map((s) => {
        const mine = B.filter((b) => b.staffId === s.id && (b.status === "paid" || b.status === "in_session"));
        return {
          s,
          sessions: mine.length,
          reports: mine.filter((b) => R.some((r) => r.bookingId === b.id)).length,
          visits: V.filter((v) => v.staffId === s.id).length,
        };
      })
      .filter((x) => x.sessions || x.visits);
  }, [staff, B, R, V]);

  const events = useMemo(() => {
    const out: Event[] = [];
    for (const v of V) {
      out.push({ at: v.arrivedAt, kind: "pasien", icon: BedDouble, text: `${v.customerName} datang (${peopleText(v)})` });
      if (v.startedAt) out.push({ at: v.startedAt, kind: "pasien", icon: BedDouble, text: `${v.customerName} mulai sesi dengan ${v.staffName ?? "-"}`, tone: "amber" });
      if (v.endedAt) out.push({ at: v.endedAt, kind: "pasien", icon: BedDouble, text: `${v.customerName} selesai sesi`, tone: "jade" });
      if (v.stage === "cancelled" && v.closedAt) out.push({ at: v.closedAt, kind: "pasien", icon: BedDouble, text: `Kunjungan ${v.customerName} dibatalkan`, tone: "danger" });
    }
    for (const s of S) {
      const pk = s.items.filter((i) => i.kind === "package");
      out.push({
        at: s.createdAt,
        kind: "uang",
        icon: ReceiptText,
        tone: s.status === "void" ? "danger" : undefined,
        text: `${s.invoiceNo} ${s.customerName}, ${rupiah(s.total)}${pk.length ? `, paket ${pk.map((i) => i.name).join(", ")} oleh ${pk[0].soldByName ?? s.createdByName ?? "-"}` : ""}${s.status === "void" ? " (dibatalkan)" : ""}`,
      });
    }
    for (const r of R) {
      out.push({ at: r.createdAt, kind: "laporan", icon: FileText, text: `${r.staffName} membuat laporan ${r.customerName}`, tone: "jade" });
      if (r.sentAt) out.push({ at: r.sentAt, kind: "laporan", icon: FileText, text: `Laporan ${r.customerName} dikirim ke pasien` });
    }
    for (const r of RS) {
      out.push({ at: r.createdAt, kind: "restock", icon: PackagePlus, tone: r.urgent ? "danger" : undefined, text: `${r.createdByName} mengajukan ${r.item} ${r.qty} ${r.unit}${r.urgent ? " (urgent)" : ""}` });
      if (r.orderedAt) out.push({ at: r.orderedAt, kind: "restock", icon: PackagePlus, text: `${r.orderedByName} memesan ${r.item} ${r.qty} ${r.unit}` });
      if (r.done && r.doneAt) out.push({ at: r.doneAt, kind: "restock", icon: PackagePlus, tone: "jade", text: `${r.doneByName} menerima ${r.item}` });
    }
    for (const a of A) {
      out.push({ at: a.inAt, kind: "tim", icon: Clock, text: `${a.name} absen masuk` });
      if (a.outAt)
        out.push({
          at: a.outAt,
          kind: "tim",
          icon: a.closing === "overtime" ? Timer : Clock,
          tone: a.closing === "overtime" ? "amber" : undefined,
          text: `${a.name} pulang${a.closing === "overtime" ? `, lembur ${durationText(a.overtimeMin)}` : ""}${a.note ? ` (${a.note})` : ""}`,
        });
    }
    for (const r of requests ?? []) {
      out.push({ at: r.createdAt, kind: "online", icon: Globe, text: `${r.accountName} booking online untuk ${r.personName}, ${shortDate(r.startAt)} ${time(r.startAt)}` });
      if (r.handledAt && r.status !== "pending")
        out.push({
          at: r.handledAt,
          kind: "online",
          icon: Globe,
          tone: r.status === "confirmed" ? "jade" : "danger",
          text: `Booking online ${r.personName} ${r.status === "confirmed" ? "dikonfirmasi" : r.status === "rejected" ? "ditolak" : "dibatalkan"}`,
        });
    }
    return out.sort((a, b) => b.at - a.at);
  }, [V, S, R, RS, A, requests]);
  const filtered = only === "all" ? events : events.filter((e) => e.kind === only);
  const feed = usePager(filtered, "ringkasan-aktivitas", 25);
  const shown = feed.shown;
  const loading = !visits || !sales || !bookings;

  return (
    <div className="mx-auto max-w-6xl pb-16">
      <PageHeader
        title="Ringkasan"
        subtitle="Semua yang terjadi di klinik: pasien, transaksi, tim, laporan, restock, dan booking online"
        actions={
          <Segmented
            value={range}
            onChange={setRange}
            options={[
              { value: "today", label: "Hari ini" },
              { value: "7d", label: "7 hari" },
              { value: "month", label: "Bulan ini" },
            ]}
          />
        }
      />
      {loading ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-6 px-4 md:px-8">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile href="/alur" icon={BedDouble} label="Pasien walk-in" value={num(stats.walkIns)} sub={`${stats.people} orang, ${stats.inClinic} di klinik sekarang`} />
            <Tile href="/kalender" icon={CalendarCheck} label="Sesi terapi" value={num(stats.sessions)} sub={`Rata-rata tunggu ${stats.avgWait} mnt, ${stats.cancelled} batal`} />
            <Tile href="/laporan" icon={ReceiptText} label="Pemasukan" value={`Rp ${rupiahShort(stats.revenue)}`} sub={`${stats.invoices} faktur, ${stats.pkgCount} paket (Rp ${rupiahShort(stats.pkgValue)})`} />
            <Tile
              href="/laporan-terapi"
              icon={FileText}
              label="Laporan terapi"
              value={`${stats.reportsDone}/${stats.reportsDue}`}
              sub={`${stats.reportsDue - stats.reportsDone} belum dibuat, ${stats.reportsUnsent} belum dikirim`}
              alert={stats.reportsDone < stats.reportsDue}
            />
            <Tile href="/jadwal-kerja" icon={Timer} label="Lembur" value={durationText(stats.overtime)} sub={`${stats.overtimeDays} kali, ${stats.present} staf masuk hari ini${stats.notOut ? `, ${stats.notOut} lupa absen pulang` : ""}`} alert={stats.notOut > 0} />
            <Tile href="/restock" icon={PackagePlus} label="Restock terbuka" value={num(stats.restockOpen)} sub={`${stats.restockUrgent} urgent, ${stats.restockNew} diajukan di rentang ini`} alert={stats.restockUrgent > 0} />
            <Tile href="/kalender" icon={Globe} label="Booking online" value={num(stats.requestsNew)} sub={`${stats.requestsPending} menunggu konfirmasi`} alert={stats.requestsPending > 0} />
            <Tile href="/pelanggan" icon={Ticket} label="Paket hampir kedaluwarsa" value={num(stats.expiring)} sub={`Dalam ${settings.reminderDays} hari, perlu diingatkan`} alert={stats.expiring > 0} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-3">
                <h2 className="font-bold">Aktivitas</h2>
                <div className="no-scrollbar flex gap-1 overflow-x-auto">
                  {(["all", ...Object.keys(KIND_LABEL)] as (Kind | "all")[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setOnly(k)}
                      aria-pressed={only === k}
                      className={cx(
                        "h-7 shrink-0 rounded-full px-2.5 text-[12px] font-semibold",
                        only === k ? "bg-jade-mist text-jade-deep" : "text-muted hover:bg-line-soft",
                      )}
                    >
                      {k === "all" ? "Semua" : KIND_LABEL[k]}
                    </button>
                  ))}
                </div>
              </div>
              {shown.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted">Belum ada aktivitas di rentang ini.</p>
              ) : (
                <ol>
                  {shown.map((e, i) => {
                    const Icon = e.icon;
                    const newDay = i === 0 || dateKey(shown[i - 1].at) !== dateKey(e.at);
                    return (
                      <li key={i}>
                        {newDay && range !== "today" && (
                          <p className="sticky top-0 z-[1] bg-canvas px-4 py-1.5 text-[12px] font-bold text-ink-2">{shortDate(e.at)}</p>
                        )}
                        <div className="flex items-start gap-3 px-4 py-2.5">
                          <span className="tnum w-11 shrink-0 pt-0.5 text-[12px] font-semibold text-muted">{time(e.at)}</span>
                          <span
                            className={cx(
                              "flex size-7 shrink-0 items-center justify-center rounded-full",
                              e.tone === "amber" ? "bg-amber-mist text-amber" : e.tone === "jade" ? "bg-jade-mist text-jade" : e.tone === "danger" ? "bg-danger-mist text-danger" : "bg-line-soft text-ink-2",
                            )}
                          >
                            <Icon className="size-3.5" />
                          </span>
                          <p className="min-w-0 flex-1 pt-1 text-sm">{e.text}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
              {filtered.length > 0 && <Pager pager={feed} label="aktivitas" className="border-t border-line-soft px-4 py-2" />}
            </Card>

            <Card className="h-fit overflow-hidden">
              <h2 className="border-b border-line-soft px-4 py-3 font-bold">Per fisioterapis</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[12px] text-muted">
                    <th className="px-4 py-2 font-semibold">Terapis</th>
                    <th className="px-2 py-2 text-right font-semibold">Sesi</th>
                    <th className="px-4 py-2 text-right font-semibold">Laporan</th>
                  </tr>
                </thead>
                <tbody>
                  {perStaff.map(({ s, sessions, reports: done }) => (
                    <tr key={s.id} className="border-t border-line-soft">
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-2 font-semibold">
                          <span className="size-2.5 rounded-full" style={{ background: staffColor(s.color).dot }} />
                          {s.name}
                        </span>
                      </td>
                      <td className="tnum px-2 py-2.5 text-right font-semibold">{sessions}</td>
                      <td className={cx("tnum px-4 py-2.5 text-right font-semibold", done < sessions ? "text-amber" : "text-jade-deep")}>
                        {done}/{sessions}
                      </td>
                    </tr>
                  ))}
                  {perStaff.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-muted">
                        Belum ada sesi.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({
  href,
  icon: Icon,
  label,
  value,
  sub,
  alert,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  alert?: boolean;
}) {
  return (
    <Link href={href} className={cx("rounded-xl border bg-surface p-4 transition-shadow hover:shadow-[var(--shadow-lift)]", alert ? "border-amber/40" : "border-line")}>
      <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
        <Icon className={cx("size-4", alert ? "text-amber" : "text-jade")} />
        {label}
      </p>
      <p className="tnum mt-1.5 text-2xl font-bold tracking-[-0.01em]">{value}</p>
      <p className="mt-0.5 text-[12px] leading-snug text-muted">{sub}</p>
    </Link>
  );
}
