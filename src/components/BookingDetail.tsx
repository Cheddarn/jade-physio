"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, Pencil, Play, ReceiptText, RotateCcw, UserRound, XCircle } from "lucide-react";
import { Badge, Button, Confirm, Sheet, errorText, useToast } from "./ui";
import { VoucherCard } from "./Beads";
import { waLink } from "./CustomerPicker";
import { useCollection } from "@/lib/hooks";
import { useCan, useUser } from "@/lib/auth";
import { canRunSession } from "@/lib/roles";
import { setBookingStatus, voucherCovers, voucherState } from "@/lib/actions";
import { STATUS_LABEL, duration, longDate, rupiah, staffColor, time } from "@/lib/format";
import type { Row } from "@/lib/store";
import type { Booking, Staff, Voucher } from "@/lib/types";

export function StatusBadge({ status }: { status: Booking["status"] }) {
  const tone = status === "in_session" ? "amber" : status === "paid" ? "jade" : status === "cancelled" ? "danger" : "neutral";
  return (
    <Badge tone={tone}>
      {status === "in_session" && <span className="pulse-dot size-1.5 rounded-full bg-amber" />}
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function BookingDetail({
  booking,
  staff,
  onClose,
  onEdit,
}: {
  booking: Row<Booking> | null;
  staff: Row<Staff>[];
  onClose: () => void;
  onEdit: (b: Row<Booking>) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const user = useUser();
  const can = useCan();
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const { rows: vouchers } = useCollection<Voucher>(booking ? "vouchers" : null, [
    ["customerId", "==", booking?.customerId ?? ""],
  ]);
  const usable = (vouchers ?? []).filter((v) => voucherState(v) === "active" && booking && voucherCovers(v, booking.serviceId));

  if (!booking) return null;
  const b = booking;
  const st = staff.find((s) => s.id === b.staffId);
  const c = staffColor(st?.color);
  const wa = waLink(b.customerPhone);

  async function start() {
    setBusy(true);
    try {
      await setBookingStatus(b.id, "in_session");
      toast(`Sesi ${b.customerName} dimulai`);
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  const goCheckout = () => router.push(`/checkout?booking=${b.id}`);
  const manage = can("bookings.manage");
  const runSession = canRunSession(user, b);

  let footer: React.ReactNode = undefined;
  if (b.status === "paid") {
    footer = can("sales.view") ? (
      <Link href={`/faktur/${b.saleId}`} className="block">
        <Button size="lg" block variant="secondary" icon={<ReceiptText className="size-4" />}>
          Lihat faktur {b.invoiceNo}
        </Button>
      </Link>
    ) : undefined;
  } else if (b.status === "cancelled") {
    footer = manage ? (
      <Button
        size="lg"
        block
        variant="secondary"
        icon={<RotateCcw className="size-4" />}
        onClick={async () => {
          await setBookingStatus(b.id, "booked");
          toast("Booking dipulihkan");
        }}
      >
        Pulihkan booking
      </Button>
    ) : undefined;
  } else {
    const showStart = b.status === "booked" && runSession;
    const showCheckout = can("checkout");
    footer =
      showStart || showCheckout ? (
        <div className="flex gap-2">
          {showStart && (
            <Button
              size="lg"
              variant={showCheckout ? "secondary" : "primary"}
              className="flex-1"
              loading={busy}
              icon={<Play className="size-4" />}
              onClick={start}
            >
              Mulai sesi
            </Button>
          )}
          {showCheckout && (
            <Button size="lg" className="flex-1" onClick={goCheckout}>
              Checkout
            </Button>
          )}
        </div>
      ) : b.status === "in_session" && runSession ? (
        <p className="py-1 text-center text-sm text-muted">Sesi berjalan. Kasir akan melakukan checkout setelah selesai.</p>
      ) : undefined;
  }

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title="Detail booking"
        footer={footer}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xl font-bold leading-tight">{b.customerName}</p>
            <p className="mt-1 text-sm text-muted">{b.customerPhone || "Tanpa nomor"}</p>
          </div>
          <StatusBadge status={b.status} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/pelanggan/${b.customerId}`}>
            <Button size="sm" variant="secondary" icon={<UserRound className="size-3.5" />}>
              Profil pelanggan
            </Button>
          </Link>
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer">
              <Button size="sm" variant="secondary" icon={<MessageCircle className="size-3.5" />}>
                WhatsApp
              </Button>
            </a>
          )}
        </div>

        <dl className="mt-6 divide-y divide-line-soft rounded-xl border border-line">
          <DetailRow label="Layanan" value={b.serviceName} />
          {b.packageName && b.status !== "paid" && <DetailRow label="Paket" value={`Beli ${b.packageName} saat checkout`} />}
          <DetailRow
            label="Terapis"
            value={
              <span className="inline-flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: c.dot }} />
                {b.staffName}
              </span>
            }
          />
          <DetailRow label="Tanggal" value={longDate(b.startAt)} />
          <DetailRow
            label="Jam"
            value={
              <span className="tnum">
                {time(b.startAt)}–{time(b.startAt + b.durationMin * 60_000)}
                <span className="ml-2 text-muted">{duration(b.durationMin)}</span>
              </span>
            }
          />
          {can("money.view") && <DetailRow label="Harga" value={<span className="tnum">{rupiah(b.price)}</span>} />}
          {b.notes ? <DetailRow label="Catatan" value={b.notes} /> : null}
        </dl>

        {b.status !== "paid" && usable.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-[13px] font-semibold text-ink-2">Voucher yang bisa dipakai saat checkout</p>
            <div className="grid gap-2">
              {usable.map((v) => (
                <VoucherCard key={v.id} v={v} compact />
              ))}
            </div>
          </div>
        )}

        {(b.status === "booked" || b.status === "in_session") && (manage || runSession) && (
          <div className="mt-6 flex flex-wrap gap-2">
            {manage && (
              <Button variant="ghost" size="sm" icon={<Pencil className="size-3.5" />} onClick={() => onEdit(b)}>
                Ubah
              </Button>
            )}
            {b.status === "in_session" && runSession && (
              <Button
                variant="ghost"
                size="sm"
                icon={<RotateCcw className="size-3.5" />}
                onClick={async () => {
                  await setBookingStatus(b.id, "booked");
                  toast("Status dikembalikan ke menunggu");
                }}
              >
                Kembalikan ke menunggu
              </Button>
            )}
            {manage && (
              <Button
                variant="ghost"
                size="sm"
                className="text-danger hover:bg-danger-mist hover:text-danger"
                icon={<XCircle className="size-3.5" />}
                onClick={() => setConfirmCancel(true)}
              >
                Batalkan booking
              </Button>
            )}
          </div>
        )}
      </Sheet>

      <Confirm
        open={confirmCancel}
        title="Batalkan booking ini?"
        body={`${b.customerName}, ${b.serviceName} pukul ${time(b.startAt)}. Booking bisa dipulihkan nanti.`}
        confirmLabel="Batalkan booking"
        tone="danger"
        onClose={() => setConfirmCancel(false)}
        onConfirm={async () => {
          await setBookingStatus(b.id, "cancelled");
          setConfirmCancel(false);
          toast("Booking dibatalkan");
          onClose();
        }}
      />
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 px-4 py-3 text-sm">
      <dt className="w-20 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium">{value}</dd>
    </div>
  );
}
