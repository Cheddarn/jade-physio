"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CalendarPlus, ClipboardList, MessageCircle, Pencil, ShoppingBag, Ticket, TicketPlus } from "lucide-react";
import { Avatar, Badge, Button, Card, Empty, Segmented, Spinner, cx } from "@/components/ui";
import { VoucherCard } from "@/components/Beads";
import { BookingSheet } from "@/components/BookingSheet";
import { StatusBadge } from "@/components/BookingDetail";
import { CustomerForm } from "@/components/CustomerForm";
import { PatientForm } from "@/components/PatientForm";
import { RelationGraph } from "@/components/RelationGraph";
import { DOCUMENTS, GENDER_LABEL, SOURCES, ageFrom, labelsOf, medicalFlags } from "@/lib/flow";
import { waLink } from "@/components/CustomerPicker";
import { IssueVoucherSheet, SellPackageSheet, VoucherDetail } from "@/components/VoucherSheets";
import { useCollection, useDoc } from "@/lib/hooks";
import { patientInfo, updateCustomer, voucherState } from "@/lib/actions";
import { useCan } from "@/lib/auth";
import { PAYMENT_LABEL, dateTime, dayMonth, remaining, rupiah, rupiahShort, shortDate } from "@/lib/format";
import type { Booking, Customer, Sale, TherapyReport, Visit, Voucher } from "@/lib/types";
import { PurchaseHistory, SessionHistory } from "@/components/CustomerHistory";

type Tab = "voucher" | "sesi" | "pembelian";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { row: c, loading } = useDoc<Customer>("customers", id);
  const { rows: vouchers } = useCollection<Voucher>("vouchers", [["customerId", "==", id]]);
  const { rows: bookings } = useCollection<Booking>("bookings", [["customerId", "==", id]]);
  const can = useCan();
  const { rows: sales } = useCollection<Sale>(can("sales.view") ? "sales" : null, [["customerId", "==", id]]);
  const { rows: reports } = useCollection<TherapyReport>("reports", [["customerId", "==", id]]);
  const { rows: walkIns } = useCollection<Visit>("visits", [["customerId", "==", id]]);
  const [tab, setTab] = useState<Tab>("voucher");
  const [editing, setEditing] = useState(false);
  const [booking, setBooking] = useState(false);
  const [selling, setSelling] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [intake, setIntake] = useState(false);
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
          <p className="mt-0.5 text-[13px] text-muted">
            {c.source === "online"
              ? `Daftar online${c.accountEmail ? `, akun ${c.accountEmail}` : ""}`
              : `Didaftarkan di klinik${c.accountEmail ? `, juga punya akun online (${c.accountEmail})` : ""}`}
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
            {can("customers.edit") && (
              <Button size="sm" variant={c.profile ? "secondary" : "primary"} icon={<ClipboardList className="size-3.5" />} onClick={() => setIntake(true)}>
                {c.profile ? "Formulir pasien" : "Isi formulir pasien"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {(c.profile || c.gender || Object.values(patientInfo(c)).some(Boolean)) && <ProfileCard c={c} />}

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

      <RelationGraph customer={c} />

      <Segmented
        className="mt-8 w-full md:w-auto"
        value={tab}
        onChange={setTab}
        options={[
          { value: "voucher", label: `Voucher (${active.length})` },
          {
            value: "sesi",
            label: (
              <>
                <span className="sm:hidden">Sesi</span>
                <span className="hidden sm:inline">Riwayat sesi</span> ({visits.filter((b) => b.status !== "cancelled").length})
              </>
            ),
          },
          ...(can("sales.view")
            ? [
                {
                  value: "pembelian" as const,
                  label: (
                    <>
                      <span className="sm:hidden">Pembelian</span>
                      <span className="hidden sm:inline">Riwayat pembelian</span> ({invoices.length + past.concat(active).filter((v) => v.source === "manual").length})
                    </>
                  ),
                },
              ]
            : []),
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

        {tab === "sesi" && (
          <SessionHistory bookings={visits} vouchers={vouchers ?? []} sales={sales} reports={reports ?? []} visits={walkIns ?? []} />
        )}

        {tab === "pembelian" && can("sales.view") && <PurchaseHistory sales={invoices} vouchers={vouchers ?? []} customerName={c.name} />}
      </div>

      <PatientForm open={intake} onClose={() => setIntake(false)} customer={c} />
      <CustomerForm
        open={editing}
        onClose={() => setEditing(false)}
        initial={{ name: c.name, phone: c.phone, email: c.email ?? "", notes: c.notes ?? "", gender: c.gender ?? undefined, ...patientInfo(c) }}
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

/** The patient's data: the basics for everyone, plus the registration form once it is filled in. */
function ProfileCard({ c }: { c: Customer }) {
  const p = c.profile;
  const info = patientInfo(c);
  const age = ageFrom(info.birthDate);
  const flags = p ? medicalFlags(p) : [];
  const rows: [string, string | undefined][] = [
    ["No. RM", p?.medicalRecordNo],
    ["Jenis kelamin", c.gender ? GENDER_LABEL[c.gender] : undefined],
    ["Lahir", [p?.birthPlace, info.birthDate ? shortDate(info.birthDate) : "", age != null ? `${age} tahun` : ""].filter(Boolean).join(", ")],
    ["No. KTP", info.nik],
    ["Pekerjaan", p?.occupation],
    ["Tinggi / berat", p?.heightCm || p?.weightKg ? `${p.heightCm ?? "-"} cm, ${p.weightKg ?? "-"} kg` : undefined],
    ["Alamat", info.address],
    ["Asuransi", p?.insurance === "ya" ? p.insuranceName || "Ya" : p?.insurance === "tidak" ? "Tidak" : undefined],
    ["Kontak darurat", [p?.emergencyName, p?.emergencyRelation, p?.emergencyPhone].filter(Boolean).join(", ")],
    ["Keluhan utama", [p?.complaint, p?.complaintSince ? `sejak ${p.complaintSince}` : ""].filter(Boolean).join(", ")],
    ["Cedera", p?.injury === "ya" ? p.injuryDetail || "Ya" : undefined],
    ["Obat rutin", p?.routineMeds === "ya" ? p.routineMedsDetail || "Ya" : undefined],
    ["Dokumen", p ? labelsOf(DOCUMENTS, p.documents, p.documentsOther).join(", ") : undefined],
    ["Tahu dari", p ? labelsOf(SOURCES, p.sources, p.sourcesOther).join(", ") : undefined],
  ];
  return (
    <div className="mt-5 rounded-xl border border-line bg-surface">
      {flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-line-soft px-4 py-3">
          {flags.map((f) => (
            <Badge key={f} tone="danger">
              <AlertTriangle className="size-3" />
              {f}
            </Badge>
          ))}
        </div>
      )}
      <dl className="grid gap-x-6 px-4 py-2 text-sm sm:grid-cols-2">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="flex gap-3 border-b border-line-soft py-2 last:border-0 sm:[&:nth-last-child(2)]:border-0">
              <dt className="w-28 shrink-0 text-muted">{k}</dt>
              <dd className="min-w-0 flex-1 font-medium">{v}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}
