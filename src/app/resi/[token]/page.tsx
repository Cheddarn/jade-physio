"use client";

import { useParams } from "next/navigation";
import { CheckCircle2, Printer, XCircle } from "lucide-react";
import { Logo } from "@/components/AppShell";
import { Spinner, cx } from "@/components/ui";
import { useDoc } from "@/lib/hooks";
import { BUSINESS, PAYMENT_LABEL, longDate, rupiah, time } from "@/lib/format";
import type { PaymentMethod, Receipt } from "@/lib/types";

/** Public receipt: anyone with the link can view it, no login. */
export default function ReceiptPage() {
  const { token } = useParams<{ token: string }>();
  const { row: r, loading } = useDoc<Receipt>("receipts", token);

  if (loading) return <Spinner className="min-h-dvh" />;
  if (!r)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <Logo />
        <p className="mt-8 text-lg font-bold">Resi tidak ditemukan</p>
        <p className="mt-1 max-w-xs text-sm text-muted">Periksa kembali link dari {BUSINESS.name}, atau hubungi kami.</p>
      </div>
    );

  const isVoid = r.status === "void";
  const lineDiscount = r.items.reduce((n, i) => n + (i.discount || 0), 0);
  const billDiscount = r.discount - lineDiscount;

  return (
    <div className="min-h-dvh bg-canvas px-4 py-6 sm:py-12">
      <main className="print-plain mx-auto max-w-md overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-lift)]">
        <header className={cx("px-5 pt-6 pb-5 text-center text-white", isVoid ? "bg-ink-2" : "bg-jade-deep")}>
          <p className="text-sm font-semibold tracking-wide text-white/80 uppercase">{BUSINESS.name}</p>
          <span className="mx-auto mt-3 flex size-12 items-center justify-center rounded-full bg-white/15">
            {isVoid ? <XCircle className="size-7" /> : <CheckCircle2 className="size-7" />}
          </span>
          <p className="mt-2 text-sm text-white/80">{isVoid ? "Transaksi dibatalkan" : "Pembayaran berhasil"}</p>
          <p className={cx("tnum mt-1 text-[32px] leading-tight font-bold", isVoid && "line-through opacity-70")}>{rupiah(r.total)}</p>
          <p className="mt-1 text-[13px] text-white/80">{PAYMENT_LABEL[r.paymentMethod as PaymentMethod | "voucher"] ?? r.paymentMethod}</p>
        </header>

        <dl className="grid grid-cols-2 gap-3 border-b border-dashed border-line px-5 py-4 text-sm">
          <div>
            <dt className="text-[12px] text-muted">No. resi</dt>
            <dd className="tnum font-semibold">{r.invoiceNo}</dd>
          </div>
          <div className="text-right">
            <dt className="text-[12px] text-muted">Tanggal</dt>
            <dd className="font-semibold">
              {longDate(r.createdAt).replace(/^\w+, /, "")}, {time(r.createdAt)}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[12px] text-muted">Pasien</dt>
            <dd className="font-semibold">{r.customerName}</dd>
          </div>
        </dl>

        <ul className="px-5 py-3">
          {r.items.map((i, k) => (
            <li key={k} className="flex items-start justify-between gap-3 border-b border-line-soft py-3 text-sm last:border-0">
              <div className="min-w-0">
                <p className="font-semibold">
                  {i.qty > 1 ? `${i.qty}× ` : ""}
                  {i.name}
                </p>
                <p className="text-[12px] text-muted">
                  {i.kind === "package" ? "Paket sesi prabayar" : i.staffName || ""}
                </p>
                {i.voucher && <p className="text-[12px] font-semibold text-jade-deep">Dibayar dengan sesi paket</p>}
                {!!i.discount && (
                  <p className="text-[12px] font-semibold text-jade-deep">
                    Diskon {i.discountName}: −{rupiah(i.discount)}
                  </p>
                )}
              </div>
              <p className="tnum shrink-0 text-right">
                {(i.voucher || !!i.discount) && <span className="block text-[12px] text-muted line-through">{rupiah(i.unitPrice * i.qty)}</span>}
                <span className="font-semibold">{rupiah(i.amount)}</span>
              </p>
            </li>
          ))}
        </ul>

        <dl className="mx-5 mb-5 flex flex-col gap-1.5 rounded-xl bg-canvas px-4 py-3 text-sm">
          <Row label="Subtotal" value={rupiah(r.subtotal)} />
          {r.voucherCovered > 0 && <Row label="Dibayar sesi paket" value={`−${rupiah(r.voucherCovered)}`} />}
          {lineDiscount > 0 && <Row label="Diskon item" value={`−${rupiah(lineDiscount)}`} />}
          {billDiscount > 0 && <Row label={`Diskon${r.billDiscountName ? ` (${r.billDiscountName})` : ""}`} value={`−${rupiah(billDiscount)}`} />}
          <div className="mt-1 flex items-baseline justify-between border-t border-line pt-2">
            <dt className="font-bold">Total</dt>
            <dd className="tnum text-lg font-bold">{rupiah(r.total)}</dd>
          </div>
        </dl>

        <footer className="border-t border-line-soft px-5 py-4 text-center text-[13px] text-muted">
          {BUSINESS.address && <p>{BUSINESS.address}</p>}
          {BUSINESS.phone && <p>{BUSINESS.phone}</p>}
          <p className="mt-1">Terima kasih, semoga lekas pulih.</p>
        </footer>
      </main>
      <button
        type="button"
        onClick={() => window.print()}
        className="no-print mx-auto mt-4 flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-jade hover:bg-jade-mist"
      >
        <Printer className="size-4" />
        Simpan / cetak resi
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="tnum">{value}</dd>
    </div>
  );
}
