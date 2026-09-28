"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarPlus, MessageCircle, Pencil, ShoppingBag, Ticket, TicketPlus } from "lucide-react";
import { Avatar, Badge, Button, Card, Empty, Segmented, Spinner, cx } from "@/components/ui";
import { VoucherCard } from "@/components/Beads";
import { BookingSheet } from "@/components/BookingSheet";
import { StatusBadge } from "@/components/BookingDetail";
import { CustomerForm } from "@/components/CustomerForm";
import { waLink } from "@/components/CustomerPicker";
import { IssueVoucherSheet, SellPackageSheet, VoucherDetail } from "@/components/VoucherSheets";
import { useCollection, useDoc } from "@/lib/hooks";
import { updateCustomer, voucherState } from "@/lib/actions";
import { useCan } from "@/lib/auth";
import { PAYMENT_LABEL, dateTime, dayMonth, remaining, rupiah, rupiahShort, shortDate } from "@/lib/format";
import type { Booking, Customer, Sale, Voucher } from "@/lib/types";

type Tab = "voucher" | "kunjungan" | "faktur";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { row: c, loading } = useDoc<Customer>("customers", id);
  const { rows: vouchers } = useCollection<Voucher>("vouchers", [["customerId", "==", id]]);
  const { rows: bookings } = useCollection<Booking>("bookings", [["customerId", "==", id]]);
  const can = useCan();
  const { rows: sales } = useCollection<Sale>(can("sales.view") ? "sales" : null, [["customerId", "==", id]]);
  const [tab, setTab] = useState<Tab>("voucher");
  const [editing, setEditing] = useState(false);
  const [booking, setBooking] = useState(false);
  const [selling, setSelling] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [openVoucher, setOpenVoucher] = useState<string | null>(null);

  const active = useMemo(() => (vouchers ?? []).filter((v) => voucherState(v) === "active"), [vouchers]);
  const past = useMemo(
    () => (vouchers ?? []).filter((v) => voucherState(v) !== "active").sort((a, b) => b.purchasedAt - a.purchasedAt),
    [vouchers],
  );
  const visits = useMemo(() => [...(bookings ?? [])].sort((a, b) => b.startAt - a.startAt), [bookings]);
  const invoices = useMemo(() => [...(sales ?? [])].sort((a, b) => b.createdAt - a.createdAt), [sales]);
  const spent = invoices.filter((s) => s.status === "paid").reduce((s, x) => s + x.total, 0);
  const sessionsLeft = active.reduce((s, v) => s + remaining(v), 0);
  const lastVisit = visits.find((v) => v.status === "paid");
  const bookingDraft = useMemo(() => (booking && c ? { customer: c } : null), [booking, c?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Spinner />;
  if (!c) return <Empty title="Pelanggan tidak ditemukan" action={<Link href="/pelanggan"><Button variant="secondary">Kembali</Button></Link>} />;

  const wa = waLink(c.phone);
  const tiles = [
    can("bookings.manage") && (
      <ActionTile key="b" icon={<CalendarPlus className="size-5" />} label="Booking" onClick={() => setBooking(true)} />
    ),
    can("checkout") && (
      <ActionTile key="p" icon={<ShoppingBag className="size-5" />} label="Jual paket" onClick={() => setSelling(true)} />
    ),
    can("vouchers.manual") && (
      <ActionTile key="v" icon={<TicketPlus className="size-5" />} label="Voucher manual" onClick={() => setIssuing(true)} />
    ),
  ].filter(Boolean);
  const selectedVoucher = (vouchers ?? []).find((v) => v.id === openVoucher) ?? null;

  return (
    <div className="mx-auto max-w-4xl px-4 pt-4 pb-10 md:px-8 md:pt-8">
      <button onClick={() => router.back()} className="-ml-2 mb-3 flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-ink-2 hover:bg-line-soft">
        <ArrowLeft className="size-4" />
        Pelanggan
      </button>

      <div className="flex flex-wrap items-start gap-4">
        <Avatar name={c.name} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] leading-tight font-bold tracking-[-0.01em] md:text-[26px]">{c.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {c.phone || "Tanpa nomor"}
            {c.email ? `, ${c.email}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer">
                <Button size="sm" variant="secondary" icon={<MessageCircle className="size-3.5" />}>
                  WhatsApp
                </Button>
              </a>
            )}
            {can("customers.edit") && (
              <Button size="sm" variant="secondary" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(true)}>
                Ubah data
              </Button>
            )}
          </div>
        </div>
      </div>

      {c.notes && <p className="mt-5 rounded-xl border border-line bg-surface px-4 py-3 text-sm whitespace-pre-line text-ink-2">{c.notes}</p>}

      <div className={cx("mt-6 grid gap-2 md:gap-3", can("money.view") ? "grid-cols-3" : "grid-cols-2")}>
        <Metric label="Sesi prabayar" value={String(sessionsLeft)} accent />
        {can("money.view") && <Metric
          label="Total belanja"
          value={
            <>
              <span className="md:hidden">Rp {rupiahShort(spent)}</span>
              <span className="hidden md:inline">{rupiah(spent)}</span>
            </>
          }
        />}
        <Metric
          label="Kunjungan terakhir"
          value={
            lastVisit ? (
              <>
                <span className="md:hidden">{dayMonth(lastVisit.startAt)}</span>
                <span className="hidden md:inline">{shortDate(lastVisit.startAt)}</span>
              </>
            ) : (
              "Belum ada"
            )
          }
        />
      </div>

      {tiles.length > 0 && (
        <div className="mt-5 grid gap-2" style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}>
          {tiles}
        </div>
      )}

      <Segmented
        className="mt-8 w-full md:w-auto"
        value={tab}
        onChange={setTab}
        options={[
          { value: "voucher", label: `Voucher (${active.length})` },
          { value: "kunjungan", label: `Kunjungan (${visits.length})` },
          ...(can("sales.view") ? [{ value: "faktur" as const, label: `Faktur (${invoices.length})` }] : []),
        ]}
      />

      <div className="mt-4">
        {tab === "voucher" &&
          (active.length + past.length === 0 ? (
            <Empty icon={<Ticket className="size-5" />} title="Belum punya voucher" body="Jual paket sesi agar pasien bisa checkout dengan voucher di kunjungan berikutnya." />
          ) : (
            <div className="flex flex-col gap-6">
              {active.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {active.map((v) => (
                    <VoucherCard key={v.id} v={v} compact onClick={() => setOpenVoucher(v.id)} />
                  ))}
                </div>
              )}
              {past.length > 0 && (
                <div>
                  <p className="mb-2 text-[13px] font-semibold text-muted">Riwayat voucher</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {past.map((v) => (
                      <VoucherCard key={v.id} v={v} compact onClick={() => setOpenVoucher(v.id)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

        {tab === "kunjungan" &&
          (visits.length === 0 ? (
            <Empty title="Belum ada kunjungan" />
          ) : (
            <Card className="divide-y divide-line-soft">
              {visits.map((b) => (
                <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{b.serviceName}</p>
                    <p className="truncate text-[13px] text-muted">
                      {dateTime(b.startAt)}, {b.staffName}
                    </p>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
              ))}
            </Card>
          ))}

        {tab === "faktur" &&
          (invoices.length === 0 ? (
            <Empty title="Belum ada faktur" />
          ) : (
            <Card className="divide-y divide-line-soft">
              {invoices.map((s) => (
                <Link key={s.id} href={`/faktur/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas">
                  <div className="min-w-0 flex-1">
                    <p className={cx("truncate font-semibold", s.status === "void" && "text-muted line-through")}>{s.invoiceNo}</p>
                    <p className="truncate text-[13px] text-muted">
                      {dateTime(s.createdAt)}, {PAYMENT_LABEL[s.paymentMethod]}
                    </p>
                  </div>
                  {s.status === "void" ? <Badge tone="danger">Dibatalkan</Badge> : <span className="tnum font-semibold">{rupiah(s.total)}</span>}
                </Link>
              ))}
            </Card>
          ))}
      </div>

      <CustomerForm
        open={editing}
        onClose={() => setEditing(false)}
        initial={{ name: c.name, phone: c.phone, email: c.email ?? "", notes: c.notes ?? "" }}
        onSave={(v) => updateCustomer(c.id, v)}
      />
      <BookingSheet open={booking} onClose={() => setBooking(false)} draft={bookingDraft} />
      <SellPackageSheet open={selling} onClose={() => setSelling(false)} customerId={c.id} />
      <IssueVoucherSheet open={issuing} onClose={() => setIssuing(false)} customer={c} />
      {selectedVoucher && <VoucherDetail voucher={selectedVoucher} onClose={() => setOpenVoucher(null)} />}
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className={cx("rounded-xl border px-3 py-3 md:px-4", accent ? "border-jade/30 bg-jade-mist/50" : "border-line bg-surface")}>
      <p className="truncate text-xs text-muted md:text-[13px]">{label}</p>
      <p className={cx("tnum mt-1 truncate text-[15px] font-bold md:text-lg", accent && "text-jade-deep")}>{value}</p>
    </div>
  );
}

function ActionTile({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border border-line bg-surface text-[13px] font-semibold text-ink-2 transition-colors hover:border-jade/50 hover:text-jade-deep"
    >
      <span className="text-jade">{icon}</span>
      {label}
    </button>
  );
}
