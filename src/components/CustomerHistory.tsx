"use client";

import { Pager, usePager } from "./Pager";
import { useMemo, useState } from "react";
import Link from "next/link";
import { BedDouble, CalendarCheck, CalendarClock, Download, ExternalLink, FileText, ReceiptText, ShoppingBag, Ticket, XCircle } from "lucide-react";
import { Badge, Button, Card, Empty, Segmented, cx } from "./ui";
import { StatusBadge } from "./BookingDetail";
import { useCan } from "@/lib/auth";
import { useStaff } from "@/lib/hooks";
import { PAYMENT_LABEL, duration, num, rupiah, shortDate, staffColor, time } from "@/lib/format";
import { bedLabel } from "@/lib/flow";
import type { Row } from "@/lib/store";
import type { Booking, Sale, TherapyReport, Visit, Voucher } from "@/lib/types";

const monthLabel = (ms: number) => new Date(ms).toLocaleDateString("id-ID", { month: "long", year: "numeric" });

function DateBlock({ at, tone = "jade" }: { at: number; tone?: "jade" | "muted" | "solid" }) {
  const d = new Date(at);
  return (
    <span
      className={cx(
        "flex w-12 shrink-0 flex-col items-center rounded-xl py-1 leading-tight",
        tone === "solid" ? "bg-jade text-white" : tone === "muted" ? "bg-line-soft text-muted" : "bg-jade-mist text-jade-deep",
      )}
    >
      <span className="text-[10px] font-semibold uppercase">{d.toLocaleDateString("id-ID", { weekday: "short" })}</span>
      <span className="tnum text-lg font-bold">{d.getDate()}</span>
      <span className="text-[10px] font-semibold">{d.toLocaleDateString("id-ID", { month: "short" })}</span>
    </span>
  );
}

/** Group rows into "Oktober 2026" sections, newest first. */
function byMonth<T>(rows: T[], at: (r: T) => number) {
  const out: { label: string; rows: T[] }[] = [];
  for (const r of rows) {
    const label = monthLabel(at(r));
    const last = out[out.length - 1];
    if (last?.label === label) last.rows.push(r);
    else out.push({ label, rows: [r] });
  }
  return out;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
      <p className="truncate text-[12px] text-muted">{label}</p>
      <p className="tnum truncate text-base font-bold">{value}</p>
      {sub && <p className="truncate text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

/* ---------------- Sessions ---------------- */

type SessionFilter = "semua" | "selesai" | "mendatang" | "batal";

export function SessionHistory({
  bookings,
  vouchers,
  sales,
  reports,
  visits,
}: {
  bookings: Row<Booking>[];
  vouchers: Row<Voucher>[];
  sales: Row<Sale>[] | null;
  reports: Row<TherapyReport>[];
  visits: Row<Visit>[];
}) {
  const can = useCan();
  const money = can("money.view");
  const { staff } = useStaff(true);
  const [filter, setFilter] = useState<SessionFilter>("semua");
  const now = Date.now();

  const info = useMemo(() => {
    // Which package session paid for which booking ("sesi 3 dari 5").
    // Uses come from the package's own log and from invoice lines paid with it.
    const uses = new Map<string, { bookingId: string; at: number }[]>();
    const add = (vid: string, bookingId: string, at: number) => {
      const list = uses.get(vid) ?? [];
      if (!list.some((u) => u.bookingId === bookingId)) list.push({ bookingId, at });
      uses.set(vid, list);
    };
    for (const v of vouchers) for (const r of v.redemptions ?? []) if (r.bookingId) add(v.id, r.bookingId, r.at);
    for (const s of sales ?? []) for (const i of s.items) if (i.voucherId && i.bookingId && s.status === "paid") add(i.voucherId, i.bookingId, s.createdAt);
    const viaVoucher = new Map<string, { v: Row<Voucher>; n: number }>();
    for (const v of vouchers) {
      const list = (uses.get(v.id) ?? []).sort((a, b) => a.at - b.at);
      const before = Math.max(0, v.usedSessions - list.length); // sessions used before this system
      list.forEach((u, i) => viaVoucher.set(u.bookingId, { v, n: Math.min(before + i + 1, v.totalSessions) }));
    }
    const saleItem = new Map<string, { s: Row<Sale>; amount: number }>();
    for (const s of sales ?? []) for (const i of s.items) if (i.bookingId && s.status === "paid") saleItem.set(i.bookingId, { s, amount: i.amount });
    const report = new Map(reports.map((r) => [r.bookingId, r]));
    const visit = new Map(visits.filter((v) => v.bookingId).map((v) => [v.bookingId!, v]));
    // Sequence numbers for sessions that actually happened, oldest = 1.
    const done = bookings.filter((b) => b.status === "paid" || b.status === "in_session").sort((a, b) => a.startAt - b.startAt);
    const seq = new Map(done.map((b, i) => [b.id, i + 1]));
    return { viaVoucher, saleItem, report, visit, seq };
  }, [vouchers, sales, reports, visits, bookings]);

  const sorted = useMemo(() => [...bookings].sort((a, b) => b.startAt - a.startAt), [bookings]);
  const isDone = (b: Booking) => b.status === "paid" || b.status === "in_session";
  const upcoming = sorted.filter((b) => b.status === "booked" && b.startAt >= now - 3_600_000).reverse();
  const doneList = sorted.filter(isDone);
  const cancelled = sorted.filter((b) => b.status === "cancelled");
  const list =
    filter === "selesai" ? doneList : filter === "mendatang" ? upcoming : filter === "batal" ? cancelled : sorted.filter((b) => !(b.status === "booked" && b.startAt >= now - 3_600_000));

  const sessionPager = usePager(list, "riwayat-sesi", 10);
  const viaPackage = doneList.filter((b) => info.viaVoucher.has(b.id)).length;
  const favorite = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of doneList) m.set(b.staffName, (m.get(b.staffName) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0];
  }, [doneList]);
  const reportsDone = doneList.filter((b) => info.report.has(b.id)).length;

  if (bookings.length === 0)
    return <Empty icon={<CalendarCheck className="size-5" />} title="Belum ada sesi" body="Sesi terapi pasien ini akan tercatat di sini." />;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Sesi selesai" value={num(doneList.length)} sub={doneList.length ? `terakhir ${shortDate(doneList[0].startAt)}` : undefined} />
        <Stat label="Dari paket" value={num(viaPackage)} sub={`${num(doneList.length - viaPackage)} bayar per sesi`} />
        <Stat label="Terapis tersering" value={favorite ? favorite[0] : "-"} sub={favorite ? `${favorite[1]} sesi` : undefined} />
        <Stat label="Laporan terapi" value={`${reportsDone}/${doneList.length}`} sub={cancelled.length ? `${cancelled.length} sesi dibatalkan` : undefined} />
      </div>

      {upcoming.length > 0 && filter === "semua" && (
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-[13px] font-bold text-ink-2">
            <CalendarClock className="size-4 text-jade" />
            Akan datang
          </h3>
          <Card className="divide-y divide-line-soft">
            {upcoming.map((b) => (
              <SessionRow key={b.id} b={b} staffColorKey={staff.find((s) => s.id === b.staffId)?.color} info={info} money={money} upcoming />
            ))}
          </Card>
        </section>
      )}

      <Segmented
        size="sm"
        className="w-full sm:w-auto"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "semua", label: "Riwayat" },
          { value: "selesai", label: `Selesai (${doneList.length})` },
          { value: "mendatang", label: `Mendatang (${upcoming.length})` },
          { value: "batal", label: `Batal (${cancelled.length})` },
        ]}
      />

      {list.length === 0 ? (
        <Card>
          <Empty title="Tidak ada sesi di filter ini" />
        </Card>
      ) : (
        byMonth(sessionPager.shown, (b) => b.startAt).map((g) => (
          <section key={g.label}>
            <h3 className="mb-2 text-[13px] font-bold text-ink-2 capitalize">
              {g.label} <span className="font-medium text-muted">, {g.rows.length} sesi</span>
            </h3>
            <Card className="divide-y divide-line-soft">
              {g.rows.map((b) => (
                <SessionRow key={b.id} b={b} staffColorKey={staff.find((s) => s.id === b.staffId)?.color} info={info} money={money} upcoming={filter === "mendatang"} />
              ))}
            </Card>
          </section>
        ))
      )}
      {list.length > 0 && <Pager pager={sessionPager} label="sesi" />}
    </div>
  );
}

function SessionRow({
  b,
  staffColorKey,
  info,
  money,
  upcoming,
}: {
  b: Row<Booking>;
  staffColorKey?: string;
  info: {
    viaVoucher: Map<string, { v: Row<Voucher>; n: number }>;
    saleItem: Map<string, { s: Row<Sale>; amount: number }>;
    report: Map<string, Row<TherapyReport>>;
    visit: Map<string, Row<Visit>>;
    seq: Map<string, number>;
  };
  money: boolean;
  upcoming?: boolean;
}) {
  const c = staffColor(staffColorKey);
  const pkg = info.viaVoucher.get(b.id);
  const sale = info.saleItem.get(b.id);
  const report = info.report.get(b.id);
  const visit = info.visit.get(b.id);
  const n = info.seq.get(b.id);
  const cancelled = b.status === "cancelled";
  return (
    <div className={cx("flex gap-3 px-4 py-3", cancelled && "opacity-60")}>
      <DateBlock at={b.startAt} tone={cancelled ? "muted" : upcoming ? "solid" : "jade"} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <p className="min-w-0 font-semibold">
            {n && <span className="mr-1.5 text-[12px] font-bold text-jade">Sesi ke-{n}</span>}
            {b.serviceName}
          </p>
          <StatusBadge status={b.status} />
        </div>
        <p className="tnum mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted">
          <span>
            {time(b.startAt)}–{time(b.startAt + b.durationMin * 60_000)}, {duration(b.durationMin)}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: c.dot }} />
            {b.staffName}
          </span>
          {visit?.bedId && (
            <span className="inline-flex items-center gap-1">
              <BedDouble className="size-3" />
              {bedLabel(visit.bedId)}
            </span>
          )}
        </p>
        {b.notes && <p className="mt-1 text-[13px] text-ink-2">Keluhan: {b.notes}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {pkg && (
            <Badge tone="jade">
              <Ticket className="size-3" />
              {pkg.v.name}, sesi {pkg.n}/{pkg.v.totalSessions}
            </Badge>
          )}
          {!pkg && sale && (
            <Badge tone="outline">
              <ReceiptText className="size-3" />
              {money ? `${rupiah(sale.amount)}, ${PAYMENT_LABEL[sale.s.paymentMethod]}` : "Bayar per sesi"}
            </Badge>
          )}
          {b.invoiceNo && money && (
            <Link href={`/faktur/${b.saleId}`} className="text-[12px] font-semibold text-jade hover:underline">
              {b.invoiceNo}
            </Link>
          )}
          {report ? (
            <Link href={`/laporan-terapi/${report.id}`}>
              <Badge tone="jade" className="hover:bg-jade/20">
                <FileText className="size-3" />
                Laporan terapi{report.file ? " + PDF" : ""}
              </Badge>
            </Link>
          ) : (
            b.status === "paid" && <Badge tone="amber">Laporan belum ada</Badge>
          )}
          {cancelled && (
            <Badge tone="danger">
              <XCircle className="size-3" />
              Dibatalkan
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Purchases ---------------- */

type PurchaseFilter = "semua" | "paket" | "layanan";

interface Purchase {
  id: string;
  at: number;
  sale?: Row<Sale>;
  manual?: Row<Voucher>;
}

export function PurchaseHistory({ sales, vouchers, customerName }: { sales: Row<Sale>[]; vouchers: Row<Voucher>[]; customerName: string }) {
  const [filter, setFilter] = useState<PurchaseFilter>("semua");
  const paid = sales.filter((s) => s.status === "paid");
  const voucherById = useMemo(() => new Map(vouchers.map((v) => [v.id, v])), [vouchers]);

  const purchases = useMemo<Purchase[]>(() => {
    const out: Purchase[] = sales.map((s) => ({ id: s.id, at: s.createdAt, sale: s }));
    // Packages entered by hand (e.g. carried over from the old system) have no invoice.
    for (const v of vouchers) if (v.source === "manual") out.push({ id: `m-${v.id}`, at: v.purchasedAt, manual: v });
    return out.sort((a, b) => b.at - a.at);
  }, [sales, vouchers]);

  const list = purchases.filter((p) => {
    if (filter === "semua") return true;
    if (p.manual) return filter === "paket";
    const kinds = p.sale!.items.map((i) => i.kind);
    return filter === "paket" ? kinds.includes("package") : kinds.includes("service");
  });

  const buyPager = usePager(list, "riwayat-pembelian", 10);
  const spent = paid.reduce((n, s) => n + s.total, 0);
  const pkgs = paid.flatMap((s) => s.items.filter((i) => i.kind === "package"));
  const saved = paid.reduce((n, s) => n + (s.discount || 0), 0);
  const servicesPaid = paid.flatMap((s) => s.items.filter((i) => i.kind === "service" && !i.voucherId)).length;

  function csv() {
    const rows = [["Tanggal", "Jam", "No. faktur", "Item", "Jenis", "Qty", "Harga", "Diskon", "Dibayar", "Catatan", "Metode", "Status"]];
    for (const p of [...purchases].reverse()) {
      if (p.manual) {
        const v = p.manual;
        rows.push([shortDate(v.purchasedAt), time(v.purchasedAt), "", v.name, "Paket (manual)", "1", String(v.pricePaid), "0", String(v.pricePaid), v.note ?? "", "", "Input manual"]);
        continue;
      }
      const s = p.sale!;
      for (const i of s.items)
        rows.push([
          shortDate(s.createdAt),
          time(s.createdAt),
          s.invoiceNo,
          i.name,
          i.kind === "package" ? "Paket" : "Layanan",
          String(i.qty),
          String(i.unitPrice * i.qty),
          String(i.discount ?? 0),
          String(i.amount),
          i.voucherId ? `Voucher ${i.voucherCode ?? ""}` : i.discountName ?? "",
          PAYMENT_LABEL[s.paymentMethod],
          s.status === "void" ? "Dibatalkan" : "Lunas",
        ]);
    }
    const text = "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    a.download = `riwayat-pembelian-${customerName.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (purchases.length === 0)
    return <Empty icon={<ShoppingBag className="size-5" />} title="Belum ada pembelian" body="Transaksi layanan dan paket pasien ini akan tercatat di sini." />;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Total dibayar" value={rupiah(spent)} sub={`${paid.length} transaksi`} />
        <Stat label="Paket dibeli" value={num(pkgs.reduce((n, i) => n + i.qty, 0) + vouchers.filter((v) => v.source === "manual").length)} sub={rupiah(pkgs.reduce((n, i) => n + i.amount, 0))} />
        <Stat label="Sesi dibayar langsung" value={num(servicesPaid)} />
        <Stat label="Total hemat diskon" value={rupiah(saved)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "semua", label: "Semua" },
            { value: "paket", label: "Paket" },
            { value: "layanan", label: "Layanan" },
          ]}
        />
        <Button size="sm" variant="secondary" icon={<Download className="size-3.5" />} onClick={csv}>
          Unduh CSV
        </Button>
      </div>

      {byMonth(buyPager.shown, (p) => p.at).map((g) => (
        <section key={g.label}>
          <h3 className="mb-2 text-[13px] font-bold text-ink-2 capitalize">{g.label}</h3>
          <div className="flex flex-col gap-2">
            {g.rows.map((p) => (p.manual ? <ManualRow key={p.id} v={p.manual} /> : <SaleCard key={p.id} s={p.sale!} vouchers={voucherById} />))}
          </div>
        </section>
      ))}
      {list.length > 0 && <Pager pager={buyPager} label="transaksi" />}
    </div>
  );
}

function SaleCard({ s, vouchers }: { s: Row<Sale>; vouchers: Map<string, Row<Voucher>> }) {
  const isVoid = s.status === "void";
  const billDiscount = s.discount - (s.lineDiscount ?? 0);
  return (
    <Card className={cx("p-4", isVoid && "opacity-70")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <DateBlock at={s.createdAt} tone={isVoid ? "muted" : "jade"} />
          <div>
            <Link href={`/faktur/${s.id}`} className={cx("tnum font-bold hover:text-jade", isVoid && "line-through")}>
              {s.invoiceNo}
            </Link>
            <p className="tnum text-[13px] text-muted">
              Pukul {time(s.createdAt)}, {PAYMENT_LABEL[s.paymentMethod]}
              {s.createdByName ? `, kasir ${s.createdByName}` : ""}
            </p>
          </div>
        </div>
        <div className="text-right">
          {isVoid ? <Badge tone="danger">Dibatalkan</Badge> : <p className="tnum text-lg font-bold">{rupiah(s.total)}</p>}
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5 border-t border-line-soft pt-3 text-sm">
        {s.items.map((i, k) => {
          const issued = (i.issuedVoucherIds ?? []).map((id) => vouchers.get(id)).filter(Boolean) as Row<Voucher>[];
          return (
            <li key={k} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {i.kind === "package" && <span className="mr-1.5 rounded bg-jade-mist px-1.5 py-0.5 text-[10px] font-bold text-jade-deep">PAKET</span>}
                  {i.qty > 1 ? `${i.qty}× ` : ""}
                  {i.name}
                </p>
                <p className="text-[12px] text-muted">
                  {i.staffName ? `${i.staffName}` : ""}
                  {i.voucherId ? `${i.staffName ? ", " : ""}dibayar sesi paket ${i.voucherCode ?? ""}` : ""}
                  {i.kind === "package" && i.soldByName ? `dijual oleh ${i.soldByName}` : ""}
                </p>
                {!!i.discount && (
                  <p className="text-[12px] font-semibold text-jade-deep">
                    Diskon {i.discountName}: −{rupiah(i.discount)}
                  </p>
                )}
                {issued.map((v) => (
                  <p key={v.id} className="text-[12px] font-semibold text-jade-deep">
                    <Ticket className="mr-1 inline size-3" />
                    Voucher {v.code}: sisa {v.totalSessions - v.usedSessions}/{v.totalSessions} sesi
                    {v.expiresAt ? `, berlaku s/d ${shortDate(v.expiresAt)}` : ""}
                  </p>
                ))}
              </div>
              <p className="tnum shrink-0 text-right">
                {(i.voucherId || !!i.discount) && <span className="block text-[12px] text-muted line-through">{rupiah(i.unitPrice * i.qty)}</span>}
                {rupiah(i.amount)}
              </p>
            </li>
          );
        })}
      </ul>

      {(billDiscount > 0 || s.voucherCovered > 0) && (
        <p className="mt-2 text-[12px] text-muted">
          {s.voucherCovered > 0 && `Dibayar sesi paket ${rupiah(s.voucherCovered)}`}
          {s.voucherCovered > 0 && billDiscount > 0 && ", "}
          {billDiscount > 0 && `diskon transaksi${s.billDiscountName ? ` ${s.billDiscountName}` : ""} −${rupiah(billDiscount)}`}
        </p>
      )}
      {isVoid && s.voidReason && <p className="mt-2 text-[12px] text-danger">Dibatalkan: {s.voidReason}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/faktur/${s.id}`}>
          <Button size="sm" variant="secondary" icon={<ReceiptText className="size-3.5" />}>
            Faktur
          </Button>
        </Link>
        {s.receiptToken && (
          <a href={`/resi/${s.receiptToken}`} target="_blank" rel="noreferrer">
            <Button size="sm" variant="ghost" icon={<ExternalLink className="size-3.5" />}>
              Resi online
            </Button>
          </a>
        )}
      </div>
    </Card>
  );
}

function ManualRow({ v }: { v: Row<Voucher> }) {
  return (
    <Card className="flex items-start gap-3 p-4">
      <DateBlock at={v.purchasedAt} tone="muted" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          <span className="mr-1.5 rounded bg-line-soft px-1.5 py-0.5 text-[10px] font-bold text-ink-2">PAKET MANUAL</span>
          {v.name}
        </p>
        <p className="text-[12px] text-muted">
          Dicatat manual tanpa faktur{v.note ? `, ${v.note}` : ""}. Sisa {v.totalSessions - v.usedSessions}/{v.totalSessions} sesi.
        </p>
      </div>
      <p className="tnum shrink-0 font-semibold">{rupiah(v.pricePaid)}</p>
    </Card>
  );
}
