"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, ReceiptText, Search, ShoppingBag } from "lucide-react";
import { Badge, Button, Empty, Input, PageHeader, Select, Spinner, cx } from "@/components/ui";
import { DateRangePicker, presetRange, type Range } from "@/components/DateRange";
import { useCollection } from "@/lib/hooks";
import { PAYMENT_LABEL, dateTime, num, rupiah, shortDate } from "@/lib/format";
import type { Row } from "@/lib/store";
import type { Sale } from "@/lib/types";

export default function FakturPage() {
  const router = useRouter();
  const [range, setRange] = useState<Range>(() => presetRange("7d"));
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const { rows, loading } = useCollection<Sale>("sales", [
    ["dateKey", ">=", range.from],
    ["dateKey", "<=", range.to],
  ]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return [...(rows ?? [])]
      .filter((s) => !method || s.paymentMethod === method)
      .filter((s) => !status || s.status === status)
      .filter((s) => !t || s.invoiceNo.toLowerCase().includes(t) || s.customerName.toLowerCase().includes(t))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [rows, method, status, q]);

  const paid = list.filter((s) => s.status === "paid");
  const total = paid.reduce((s, x) => s + x.total, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Faktur"
        subtitle={`${range.from === range.to ? shortDate(range.from) : `${shortDate(range.from)} – ${shortDate(range.to)}`}`}
        actions={
          <>
            <Button variant="secondary" icon={<Download className="size-4" />} onClick={() => exportCsv(list, range)} disabled={!list.length}>
              <span className="hidden sm:inline">Unduh CSV</span>
            </Button>
            <Link href="/checkout">
              <Button icon={<ShoppingBag className="size-4" />}>
                <span className="hidden sm:inline">Transaksi baru</span>
                <span className="sm:hidden">Baru</span>
              </Button>
            </Link>
          </>
        }
      />

      <div className="flex flex-col gap-3 px-4 md:px-8">
        <DateRangePicker value={range} onChange={setRange} />
        <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
          <div className="relative col-span-2 md:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="No. faktur atau pelanggan" className="pl-10" />
          </div>
          <Select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Metode" className="md:w-48">
            <option value="">Semua metode</option>
            {(["qris", "transfer", "card", "voucher"] as const).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_LABEL[m]}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className="md:w-40">
            <option value="">Semua status</option>
            <option value="paid">Lunas</option>
            <option value="void">Dibatalkan</option>
          </Select>
        </div>
        <p className="text-sm text-muted">
          <span className="tnum font-semibold text-ink">{num(list.length)}</span> faktur, pemasukan{" "}
          <span className="tnum font-semibold text-ink">{rupiah(total)}</span>
        </p>
      </div>

      <div className="px-4 pt-3 pb-10 md:px-8">
        {loading ? (
          <Spinner />
        ) : list.length === 0 ? (
          <Empty icon={<ReceiptText className="size-5" />} title="Tidak ada faktur" body="Coba ubah rentang tanggal atau filter." />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[13px] text-muted">
                    <th className="px-4 py-3 font-semibold">No. faktur</th>
                    <th className="px-4 py-3 font-semibold">Waktu</th>
                    <th className="px-4 py-3 font-semibold">Pelanggan</th>
                    <th className="px-4 py-3 font-semibold">Item</th>
                    <th className="px-4 py-3 font-semibold">Metode</th>
                    <th className="px-4 py-3 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => router.push(`/faktur/${s.id}`)}
                      className="cursor-pointer border-t border-line-soft first:border-t-0 hover:bg-canvas"
                    >
                      <td className="px-4 py-3">
                        <Link href={`/faktur/${s.id}`} className={cx("font-semibold", s.status === "void" && "text-muted line-through")}>
                          {s.invoiceNo}
                        </Link>
                      </td>
                      <td className="tnum px-4 py-3 whitespace-nowrap text-ink-2">{dateTime(s.createdAt)}</td>
                      <td className="px-4 py-3 font-medium">{s.customerName}</td>
                      <td className="max-w-64 truncate px-4 py-3 text-ink-2">{itemSummary(s)}</td>
                      <td className="px-4 py-3">
                        {s.status === "void" ? (
                          <Badge tone="danger">Dibatalkan</Badge>
                        ) : (
                          <Badge tone={s.paymentMethod === "voucher" ? "jade" : "neutral"}>{PAYMENT_LABEL[s.paymentMethod]}</Badge>
                        )}
                      </td>
                      <td className={cx("tnum px-4 py-3 text-right font-semibold", s.status === "void" && "text-muted line-through")}>
                        {rupiah(s.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone list */}
            <ul className="overflow-hidden rounded-xl border border-line bg-surface md:hidden">
              {list.map((s, i) => (
                <li key={s.id} className={i ? "border-t border-line-soft" : ""}>
                  <Link href={`/faktur/${s.id}`} className="block px-4 py-3 active:bg-canvas">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className={cx("truncate font-semibold", s.status === "void" && "text-muted line-through")}>{s.customerName}</p>
                      <p className={cx("tnum shrink-0 font-semibold", s.status === "void" && "text-muted line-through")}>{rupiah(s.total)}</p>
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-muted">{itemSummary(s)}</p>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted">
                      <span className="tnum">
                        {s.invoiceNo}, {dateTime(s.createdAt)}
                      </span>
                      {s.status === "void" ? (
                        <Badge tone="danger">Dibatalkan</Badge>
                      ) : (
                        <Badge tone={s.paymentMethod === "voucher" ? "jade" : "neutral"}>{PAYMENT_LABEL[s.paymentMethod]}</Badge>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function itemSummary(s: Sale) {
  const first = s.items[0];
  if (!first) return "";
  const more = s.items.length - 1;
  return `${first.name}${first.voucherId ? " (voucher)" : ""}${more > 0 ? ` +${more} item` : ""}`;
}

function exportCsv(list: Row<Sale>[], range: Range) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["No. faktur", "Tanggal", "Jam", "Pelanggan", "No. HP", "Item", "Subtotal", "Dibayar voucher", "Diskon", "Total", "Metode", "Referensi", "Status"];
  const lines = list.map((s) => {
    const d = new Date(s.createdAt);
    return [
      s.invoiceNo,
      s.dateKey,
      d.toTimeString().slice(0, 5),
      s.customerName,
      s.customerPhone,
      s.items.map((i) => `${i.qty}x ${i.name}${i.voucherId ? " (voucher)" : ""}`).join("; "),
      s.subtotal,
      s.voucherCovered,
      s.discount,
      s.total,
      PAYMENT_LABEL[s.paymentMethod],
      s.paymentRef,
      s.status === "void" ? "Dibatalkan" : "Lunas",
    ]
      .map(esc)
      .join(",");
  });
  const blob = new Blob(["\uFEFF" + [header.map(esc).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `faktur-jade-physio-${range.from}_${range.to}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
