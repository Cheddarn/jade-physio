"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { Button, Confirm, Field, Input, MoneyInput, Select, Sheet, Textarea, cx, errorText, useToast } from "./ui";
import { Beads, VoucherCard } from "./Beads";
import { usePackages, useServices } from "@/lib/hooks";
import { useCan } from "@/lib/auth";
import { issueVoucherManual, voidVoucher, voucherState } from "@/lib/actions";
import { atTime, dateKey, dateTime, rupiah, shortDate, validityText } from "@/lib/format";
import type { Row } from "@/lib/store";
import type { Customer, Voucher } from "@/lib/types";

export function VoucherDetail({ voucher, onClose }: { voucher: Row<Voucher> | null; onClose: () => void }) {
  const toast = useToast();
  const { services } = useServices(true);
  const [confirm, setConfirm] = useState(false);
  const can = useCan();
  if (!voucher) return null;
  const v = voucher;
  const scope =
    v.serviceIds.length === 0
      ? "Semua layanan"
      : v.serviceIds.map((id) => services.find((s) => s.id === id)?.name ?? "Layanan dihapus").join(", ");
  const redemptions = [...(v.redemptions ?? [])].sort((a, b) => b.at - a.at);

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title="Detail voucher"
        footer={
          voucherState(v) === "active" && can("vouchers.void") ? (
            <Button variant="danger" block icon={<Ban className="size-4" />} onClick={() => setConfirm(true)}>
              Batalkan voucher
            </Button>
          ) : undefined
        }
      >
        <VoucherCard v={v} />
        <dl className="mt-5 divide-y divide-line-soft rounded-xl border border-line text-sm">
          <Info label="Pelanggan" value={<Link className="font-semibold text-jade" href={`/pelanggan/${v.customerId}`}>{v.customerName}</Link>} />
          <Info label="Berlaku untuk" value={scope} />
          <Info label="Dibeli" value={shortDate(v.purchasedAt)} />
          {v.soldByName && <Info label="Dijual oleh" value={v.soldByName} />}
          {v.expiresAt && <Info label="Berlaku s/d" value={shortDate(v.expiresAt)} />}
          {can("money.view") && <Info label="Nilai" value={<span className="tnum">{rupiah(v.pricePaid)}</span>} />}
          <Info
            label="Asal"
            value={
              v.source === "manual" ? (
                "Input manual"
              ) : v.saleId && can("sales.view") ? (
                <Link className="font-semibold text-jade" href={`/faktur/${v.saleId}`}>
                  {v.invoiceNo}
                </Link>
              ) : v.invoiceNo ? (
                v.invoiceNo
              ) : (
                "Penjualan"
              )
            }
          />
          {v.note && <Info label="Catatan" value={v.note} />}
        </dl>

        <h3 className="mt-6 mb-2 text-[13px] font-semibold text-ink-2">Riwayat pemakaian</h3>
        {redemptions.length === 0 ? (
          <p className="rounded-xl bg-canvas px-4 py-4 text-sm text-muted">
            {v.usedSessions > 0 ? `${v.usedSessions} sesi terpakai sebelum dicatat di sistem ini.` : "Belum ada sesi yang dipakai."}
          </p>
        ) : (
          <ol className="overflow-hidden rounded-xl border border-line">
            {redemptions.map((r, i) => (
              <li key={i} className={cx("flex items-center gap-3 px-4 py-3 text-sm", i > 0 && "border-t border-line-soft")}>
                <span className="tnum flex size-7 shrink-0 items-center justify-center rounded-full bg-jade-mist text-xs font-bold text-jade-deep">
                  {redemptions.length - i + (v.usedSessions - redemptions.length)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.serviceName}</p>
                  <p className="truncate text-[13px] text-muted">
                    {dateTime(r.at)}
                    {r.staffName ? `, ${r.staffName}` : ""}
                  </p>
                </div>
                {can("sales.view") ? (
                  <Link href={`/faktur/${r.saleId}`} className="shrink-0 text-xs font-semibold text-jade">
                    {r.invoiceNo}
                  </Link>
                ) : (
                  <span className="shrink-0 text-xs text-muted">{r.invoiceNo}</span>
                )}
              </li>
            ))}
          </ol>
        )}
      </Sheet>
      <Confirm
        open={confirm}
        title="Batalkan voucher?"
        body={`${v.name} milik ${v.customerName}. Sisa sesi tidak bisa dipakai lagi. Pengembalian dana dilakukan di luar sistem.`}
        confirmLabel="Batalkan voucher"
        tone="danger"
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          try {
            await voidVoucher(v.id);
            toast("Voucher dibatalkan");
            setConfirm(false);
          } catch (e) {
            toast(errorText(e), "error");
          }
        }}
      />
    </>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 px-4 py-2.5">
      <dt className="w-24 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium">{value}</dd>
    </div>
  );
}

/** Add prepaid sessions without a sale, e.g. balances moved over from the old system. */
export function IssueVoucherSheet({
  open,
  onClose,
  customer,
}: {
  open: boolean;
  onClose: () => void;
  customer: Row<Customer>;
}) {
  const toast = useToast();
  const { packages } = usePackages(true);
  const { services } = useServices();
  const [pkgId, setPkgId] = useState("");
  const [name, setName] = useState("");
  const [total, setTotal] = useState(5);
  const [used, setUsed] = useState(0);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [price, setPrice] = useState(0);
  const [until, setUntil] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  function applyPackage(id: string) {
    setPkgId(id);
    const p = packages.find((x) => x.id === id);
    if (!p) return;
    setName(p.name);
    setTotal(p.sessions);
    setServiceIds(p.serviceIds);
    setPrice(p.price);
    if (p.validityDays) {
      const d = new Date();
      d.setDate(d.getDate() + p.validityDays);
      setUntil(dateKey(d));
    } else setUntil("");
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Tambah voucher manual"
      footer={
        <Button
          size="lg"
          block
          loading={busy}
          disabled={!name.trim() || total < 1}
          onClick={async () => {
            setBusy(true);
            try {
              await issueVoucherManual({
                customer,
                name,
                serviceIds,
                totalSessions: total,
                usedSessions: used,
                pricePaid: price,
                expiresAt: until ? atTime(until, "23:59") : null,
                note,
              });
              toast("Voucher ditambahkan");
              onClose();
            } catch (e) {
              toast(errorText(e), "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          Simpan voucher
        </Button>
      }
    >
      <p className="mb-5 rounded-xl bg-canvas px-4 py-3 text-sm text-ink-2">
        Untuk memindahkan sisa sesi dari sistem lama (Zenwel) atau memberi sesi kompensasi. Tidak membuat faktur. Untuk
        penjualan paket baru, gunakan Jual paket.
      </p>
      <div className="flex flex-col gap-4">
        <Field label="Isi dari paket" htmlFor="iv-pkg">
          <Select id="iv-pkg" value={pkgId} onChange={(e) => applyPackage(e.target.value)}>
            <option value="">Isi sendiri</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nama voucher" htmlFor="iv-name">
          <Input id="iv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Paket 5 sesi fisioterapi" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Total sesi" htmlFor="iv-total">
            <Input id="iv-total" type="number" min={1} value={total} onChange={(e) => setTotal(Math.max(1, Number(e.target.value) || 1))} />
          </Field>
          <Field label="Sudah terpakai" htmlFor="iv-used">
            <Input id="iv-used" type="number" min={0} max={total} value={used} onChange={(e) => setUsed(Math.min(total, Math.max(0, Number(e.target.value) || 0)))} />
          </Field>
        </div>
        <Beads total={total} used={used} />
        <Field label="Berlaku untuk layanan" hint="Kosongkan untuk semua layanan">
          <ServiceChips services={services} value={serviceIds} onChange={setServiceIds} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nilai dibayar" htmlFor="iv-price">
            <MoneyInput id="iv-price" value={price} onChange={setPrice} />
          </Field>
          <Field label="Berlaku sampai" htmlFor="iv-until" hint="Kosong = tanpa batas">
            <Input id="iv-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
          </Field>
        </div>
        <Field label="Catatan" htmlFor="iv-note">
          <Textarea id="iv-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. Pindahan dari Zenwel, faktur lama #1234" />
        </Field>
      </div>
    </Sheet>
  );
}

export function ServiceChips({
  services,
  value,
  onChange,
}: {
  services: { id: string; name: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {services.map((s) => {
        const on = value.includes(s.id);
        return (
          <button
            type="button"
            key={s.id}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== s.id) : [...value, s.id])}
            className={cx(
              "h-9 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
              on ? "border-jade bg-jade-mist text-jade-deep" : "border-line text-ink-2 hover:border-ink-2/30",
            )}
          >
            {s.name}
          </button>
        );
      })}
    </div>
  );
}

export function SellPackageSheet({ open, onClose, customerId }: { open: boolean; onClose: () => void; customerId: string }) {
  const router = useRouter();
  const { packages } = usePackages();
  return (
    <Sheet open={open} onClose={onClose} title="Jual paket sesi">
      <div className="grid gap-2">
        {packages.map((p) => (
          <button
            key={p.id}
            onClick={() => router.push(`/checkout?customer=${customerId}&package=${p.id}`)}
            className="rounded-xl border border-line px-4 py-3.5 text-left hover:border-jade/50"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="font-semibold">{p.name}</span>
              <span className="tnum font-semibold">{rupiah(p.price)}</span>
            </span>
            <Beads total={p.sessions} used={0} size={10} className="mt-2.5" />
            <span className="mt-2 block text-[13px] text-muted">
              {rupiah(Math.round(p.price / p.sessions))} per sesi
              {p.validityDays ? `, berlaku ${validityText(p.validityDays)}` : ", tanpa batas waktu"}
            </span>
          </button>
        ))}
        {packages.length === 0 && <p className="text-sm text-muted">Belum ada paket. Buat di menu Katalog.</p>}
      </div>
    </Sheet>
  );
}
