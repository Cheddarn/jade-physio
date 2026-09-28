"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Ban, MessageCircle, Printer } from "lucide-react";
import { Logo } from "@/components/AppShell";
import { Badge, Button, Confirm, Empty, Spinner, Textarea, cx, errorText, useToast } from "@/components/ui";
import { waLink } from "@/components/CustomerPicker";
import { useDoc } from "@/lib/hooks";
import { useCan } from "@/lib/auth";
import { voidSale } from "@/lib/actions";
import { BUSINESS, PAYMENT_LABEL, dateTime, longDate, rupiah, time } from "@/lib/format";
import type { Sale } from "@/lib/types";

export default function FakturDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { row: s, loading } = useDoc<Sale>("sales", id);
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");
  const can = useCan();

  if (loading) return <Spinner />;
  if (!s)
    return (
      <Empty
        title="Faktur tidak ditemukan"
        action={
          <Link href="/faktur">
            <Button variant="secondary">Kembali ke daftar faktur</Button>
          </Link>
        }
      />
    );

  const isVoid = s.status === "void";
  const wa = waLink(s.customerPhone);
  const waText = [
    `*${BUSINESS.name}*`,
    `Faktur ${s.invoiceNo}`,
    dateTime(s.createdAt),
    "",
    ...s.items.map((i) => `${i.qty}x ${i.name}${i.voucherId ? " (voucher)" : ""}: ${rupiah(i.amount)}`),
    "",
    s.voucherCovered ? `Dibayar voucher: -${rupiah(s.voucherCovered)}` : "",
    s.discount ? `Diskon: -${rupiah(s.discount)}` : "",
    `*Total: ${rupiah(s.total)}* (${PAYMENT_LABEL[s.paymentMethod]})`,
    "",
    "Terima kasih, semoga lekas pulih!",
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-10 md:px-8 md:pt-8">
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <button onClick={() => router.back()} className="-ml-2 flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-ink-2 hover:bg-line-soft">
          <ArrowLeft className="size-4" />
          Kembali
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          {wa && !isVoid && (
            <a href={`${wa}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer">
              <Button size="sm" variant="secondary" icon={<MessageCircle className="size-3.5" />}>
                Kirim WhatsApp
              </Button>
            </a>
          )}
          <Button size="sm" variant="secondary" icon={<Printer className="size-3.5" />} onClick={() => window.print()}>
            Cetak
          </Button>
          {!isVoid && can("sales.void") && (
            <Button size="sm" variant="danger" icon={<Ban className="size-3.5" />} onClick={() => setVoiding(true)}>
              Batalkan
            </Button>
          )}
        </div>
      </div>

      <article className="print-plain relative overflow-hidden rounded-2xl border border-line bg-surface p-5 md:p-8">
        {isVoid && (
          <div className="mb-5 rounded-xl bg-danger-mist px-4 py-3 text-sm text-danger">
            <p className="font-semibold">Faktur dibatalkan{s.voidedAt ? ` pada ${dateTime(s.voidedAt)}` : ""}</p>
            {s.voidReason && <p className="mt-0.5">Alasan: {s.voidReason}</p>}
          </div>
        )}

        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line-soft pb-5">
          <div>
            <Logo />
            {(BUSINESS.address || BUSINESS.phone) && (
              <p className="mt-2 text-[13px] text-muted">
                {BUSINESS.address}
                {BUSINESS.address && BUSINESS.phone ? <br /> : null}
                {BUSINESS.phone}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[13px] text-muted">Faktur</p>
            <p className="tnum text-lg font-bold">{s.invoiceNo}</p>
            <Badge tone={isVoid ? "danger" : "jade"} className="mt-1.5">
              {isVoid ? "Dibatalkan" : "Lunas"}
            </Badge>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-4 py-5 text-sm">
          <div>
            <p className="text-[13px] text-muted">Ditagihkan kepada</p>
            <p className="mt-0.5 font-semibold">{s.customerName}</p>
            {s.customerPhone && <p className="text-ink-2">{s.customerPhone}</p>}
          </div>
          <div className="text-right">
            <p className="text-[13px] text-muted">Tanggal</p>
            <p className="mt-0.5 font-semibold">{longDate(s.createdAt)}</p>
            <p className="tnum text-ink-2">Pukul {time(s.createdAt)}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-[13px] text-muted">
                <th className="py-2.5 pr-3 font-semibold">Item</th>
                <th className="py-2.5 px-3 text-center font-semibold">Qty</th>
                <th className="py-2.5 pl-3 text-right font-semibold">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {s.items.map((i, idx) => (
                <tr key={idx} className="border-b border-line-soft align-top">
                  <td className="py-3 pr-3">
                    <p className="font-semibold">{i.name}</p>
                    <p className="text-[13px] text-muted">
                      {rupiah(i.unitPrice)}
                      {i.staffName ? `, ${i.staffName}` : ""}
                    </p>
                    {i.voucherId && (
                      <p className="mt-0.5 text-[13px] font-medium text-jade-deep">Dibayar dengan voucher {i.voucherCode ?? ""}</p>
                    )}
                    {i.kind === "package" && (
                      <p className="mt-0.5 text-[13px] font-medium text-jade-deep">Voucher sesi dibuat untuk pelanggan</p>
                    )}
                  </td>
                  <td className="tnum py-3 px-3 text-center">{i.qty}</td>
                  <td className="tnum py-3 pl-3 text-right font-medium">
                    {i.voucherId ? (
                      <>
                        <span className="block text-muted line-through">{rupiah(i.unitPrice * i.qty)}</span>
                        {rupiah(0)}
                      </>
                    ) : (
                      rupiah(i.amount)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="ml-auto mt-4 flex max-w-72 flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd className="tnum">{rupiah(s.subtotal)}</dd>
          </div>
          {s.voucherCovered > 0 && (
            <div className="flex justify-between text-jade-deep">
              <dt>Dibayar voucher</dt>
              <dd className="tnum">−{rupiah(s.voucherCovered)}</dd>
            </div>
          )}
          {s.discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">Diskon</dt>
              <dd className="tnum">−{rupiah(s.discount)}</dd>
            </div>
          )}
          <div className="mt-1 flex items-baseline justify-between border-t border-line pt-3">
            <dt className="font-semibold">Total</dt>
            <dd className={cx("tnum text-xl font-bold", isVoid && "text-muted line-through")}>{rupiah(s.total)}</dd>
          </div>
          <div className="flex justify-between text-[13px]">
            <dt className="text-muted">Dibayar via</dt>
            <dd className="font-semibold">{PAYMENT_LABEL[s.paymentMethod]}</dd>
          </div>
          {s.paymentRef && (
            <div className="flex justify-between gap-3 text-[13px]">
              <dt className="text-muted">Referensi</dt>
              <dd className="truncate">{s.paymentRef}</dd>
            </div>
          )}
        </dl>

        <p className="no-print mt-6 text-right text-xs text-muted">Dicatat oleh {s.createdByName || s.createdBy}</p>
        <p className="mt-4 border-t border-line-soft pt-4 text-center text-[13px] text-muted">
          Terima kasih telah berkunjung ke {BUSINESS.name}. Semoga lekas pulih.
        </p>
      </article>

      <Confirm
        open={voiding}
        title={`Batalkan ${s.invoiceNo}?`}
        body="Sesi voucher yang terpakai akan dikembalikan, voucher dari paket di faktur ini dibatalkan, dan booking kembali berstatus menunggu. Pengembalian dana dilakukan di luar sistem."
        confirmLabel="Batalkan faktur"
        tone="danger"
        onClose={() => setVoiding(false)}
        onConfirm={async () => {
          if (!reason.trim()) {
            toast("Tulis alasan pembatalan dulu", "error");
            return;
          }
          try {
            await voidSale(s.id, reason);
            toast("Faktur dibatalkan");
            setVoiding(false);
          } catch (e) {
            toast(errorText(e), "error");
          }
        }}
      >
        <Textarea placeholder="Alasan pembatalan, mis. salah input layanan" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Confirm>
    </div>
  );
}
