"use client";

import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import { Logo } from "@/components/AppShell";
import { Spinner, cx } from "@/components/ui";
import { useDoc } from "@/lib/hooks";
import { BUSINESS, PAYMENT_LABEL, num, time } from "@/lib/format";
import type { PaymentMethod, Receipt } from "@/lib/types";

/** "07 Okt 2026" / "07 Oktober 2026". */
const day = (ms: number, month: "short" | "long") => new Date(ms).toLocaleDateString("id-ID", { day: "2-digit", month, year: "numeric" });

/** Public receipt: anyone with the link can view it, no login. Laid out like the clinic's printed receipts. */
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
      <main className="print-plain mx-auto max-w-md rounded-2xl bg-surface px-6 py-8 text-sm shadow-[var(--shadow-lift)] sm:px-8">
        {isVoid && (
          <p className="mb-6 rounded-lg border-2 border-danger px-3 py-2 text-center text-[13px] font-bold tracking-wide text-danger uppercase">
            Transaksi dibatalkan
          </p>
        )}

        <header className="text-center">
          <img src="/logo.png" width={64} height={64} alt="" className="mx-auto size-16 rounded-2xl" />
          <p className="mt-4 text-lg font-bold">{BUSINESS.name}</p>
          {BUSINESS.address && <p className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed text-ink-2">{BUSINESS.address}</p>}
          {BUSINESS.phone && <p className="text-[13px] text-ink-2">{BUSINESS.phone}</p>}
          <p className="tnum mt-6 font-bold">Faktur {r.invoiceNo}</p>
          <p className="text-ink-2">{day(r.createdAt, "short")}</p>
        </header>

        <hr className="my-5 border-line" />

        <p className="font-semibold">{r.customerName}</p>
        <ul className="mt-4 flex flex-col gap-3">
          {r.items.map((i, k) => (
            <li key={k} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto_6rem] gap-x-2">
              <span className="tnum">{i.qty}</span>
              <div className="min-w-0">
                <p className="font-medium">{i.name}</p>
                {i.at && (
                  <p className="text-[13px] text-ink-2">
                    {day(i.at, "long")} {time(i.at)}
                  </p>
                )}
                {i.kind === "package" && <p className="text-[13px] text-ink-2">Paket sesi prabayar</p>}
                {i.voucher && <p className="text-[13px] text-jade-deep">Dibayar dengan sesi paket</p>}
                {!!i.discount && (
                  <p className="text-[13px] text-jade-deep">
                    Diskon {i.discountName}: −Rp {num(i.discount)}
                  </p>
                )}
              </div>
              <span className="text-ink-2">Rp</span>
              <span className="tnum text-right">{num(i.amount)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-col gap-1.5 border-t border-line pt-3">
          <Money label="Sub Total" value={r.subtotal} />
          {r.voucherCovered > 0 && <Money label="Dibayar sesi paket" value={r.voucherCovered} minus />}
          {lineDiscount > 0 && <Money label="Diskon item" value={lineDiscount} minus />}
          {billDiscount > 0 && <Money label={`Diskon${r.billDiscountName ? ` (${r.billDiscountName})` : ""}`} value={billDiscount} minus />}
        </div>
        <div className={cx("mt-3 flex flex-col gap-1.5 border-t border-line pt-3", isVoid && "line-through opacity-60")}>
          <Money label="Total" value={r.total} strong />
          <Money label="Grand total" value={r.total} />
          <Money
            label={PAYMENT_LABEL[r.paymentMethod as PaymentMethod | "voucher"] ?? r.paymentMethod}
            value={r.total}
            sub={`${day(r.createdAt, "short")} pukul ${time(r.createdAt)}`}
          />
        </div>

        {(BUSINESS.instagram || BUSINESS.facebook) && (
          <footer className="mt-8 text-center text-[13px] text-muted">
            <p>Social media kami</p>
            {BUSINESS.instagram && (
              <p>
                Instagram:{" "}
                <a href={`https://instagram.com/${BUSINESS.instagram}`} target="_blank" rel="noreferrer" className="hover:text-jade">
                  {BUSINESS.instagram}
                </a>
              </p>
            )}
            {BUSINESS.facebook && <p>Facebook: {BUSINESS.facebook}</p>}
          </footer>
        )}
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

/** A money row: label, then "Rp" and the amount in their own right-hand columns, like the printed receipt. */
function Money({ label, value, strong, minus, sub }: { label: string; value: number; strong?: boolean; minus?: boolean; sub?: string }) {
  return (
    <div className={cx("grid grid-cols-[minmax(0,1fr)_auto_6rem] gap-x-2", strong && "text-[15px] font-bold")}>
      <span>
        {label}
        {sub && <span className="block text-[13px] font-normal text-ink-2">{sub}</span>}
      </span>
      <span className="text-ink-2">Rp</span>
      <span className="tnum text-right">
        {minus ? "−" : ""}
        {num(value)}
      </span>
    </div>
  );
}
