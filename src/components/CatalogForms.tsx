"use client";

import { useState } from "react";
import { Button, Field, Input, MoneyInput, Sheet, Switch, Textarea, cx, errorText, useToast } from "./ui";
import { Beads } from "./Beads";
import { ServiceChips } from "./VoucherSheets";
import { savePackage, saveService } from "@/lib/actions";
import { rupiah } from "@/lib/format";
import type { Row } from "@/lib/store";
import type { Discount, Package, Service } from "@/lib/types";
import { APPLIES_LABEL, discountAmount, saveDiscount } from "@/lib/discounts";

/** Common expiry choices; any number of days still works. */
export const VALIDITY_PRESETS: [number, string][] = [
  [7, "1 minggu"],
  [14, "2 minggu"],
  [30, "1 bulan"],
  [60, "2 bulan"],
  [90, "3 bulan"],
  [180, "6 bulan"],
  [365, "1 tahun"],
  [0, "Tanpa batas"],
];

const emptyService: Service = { name: "", durationMin: 60, price: 0, description: "", active: true };
const emptyPackage: Package = { name: "", sessions: 3, price: 0, serviceIds: [], validityDays: 30, active: true };

/** Resets local form state whenever the sheet opens with a different item. */
function useFormState<T extends object>(value: Row<T> | "new" | null, empty: T) {
  const [form, setForm] = useState<T>(empty);
  const [openedFor, setOpenedFor] = useState<unknown>(null);
  if (value !== openedFor) {
    setOpenedFor(value);
    if (value) {
      if (value === "new") setForm(empty);
      else {
        const { id: _id, ...rest } = value as Row<T>;
        setForm({ ...empty, ...(rest as T) });
      }
    }
  }
  return [form, setForm] as const;
}

export function ServiceForm({ value, onClose }: { value: Row<Service> | "new" | null; onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useFormState<Service>(value, emptyService);
  const [busy, setBusy] = useState(false);
  const isNew = value === "new";

  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title={isNew ? "Layanan baru" : "Ubah layanan"}
      footer={
        <Button
          size="lg"
          block
          loading={busy}
          disabled={!form.name.trim() || form.durationMin < 5}
          onClick={async () => {
            setBusy(true);
            try {
              await saveService(isNew ? null : (value as Row<Service>).id, {
                ...form,
                name: form.name.trim(),
                description: form.description?.trim() ?? "",
              });
              toast(isNew ? "Layanan ditambahkan" : "Layanan disimpan");
              onClose();
            } catch (e) {
              toast(errorText(e), "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          Simpan layanan
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nama layanan" htmlFor="sv-name">
          <Input id="sv-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="mis. Fisioterapi 60 menit" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Durasi (menit)" htmlFor="sv-dur">
            <Input
              id="sv-dur"
              type="number"
              min={5}
              step={5}
              value={form.durationMin}
              onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Harga" htmlFor="sv-price">
            <MoneyInput id="sv-price" value={form.price} onChange={(price) => setForm({ ...form, price })} />
          </Field>
        </div>
        <Field label="Keterangan (opsional)" htmlFor="sv-desc">
          <Textarea id="sv-desc" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="rounded-xl bg-canvas p-3.5">
          <Switch checked={form.active} onChange={(active) => setForm({ ...form, active })} label="Aktif, bisa dibooking dan dijual" />
        </div>
      </div>
    </Sheet>
  );
}

export function PackageForm({
  value,
  services,
  onClose,
}: {
  value: Row<Package> | "new" | null;
  services: Row<Service>[];
  onClose: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useFormState<Package>(value, emptyPackage);
  const [busy, setBusy] = useState(false);
  const isNew = value === "new";
  const perSession = form.sessions > 0 ? Math.round(form.price / form.sessions) : 0;

  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title={isNew ? "Paket sesi baru" : "Ubah paket sesi"}
      footer={
        <Button
          size="lg"
          block
          loading={busy}
          disabled={!form.name.trim() || form.sessions < 1}
          onClick={async () => {
            setBusy(true);
            try {
              await savePackage(isNew ? null : (value as Row<Package>).id, { ...form, name: form.name.trim() });
              toast(isNew ? "Paket ditambahkan" : "Paket disimpan");
              onClose();
            } catch (e) {
              toast(errorText(e), "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          Simpan paket
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nama paket" htmlFor="pk-name">
          <Input id="pk-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="mis. Paket 5 sesi fisioterapi" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jumlah sesi" htmlFor="pk-sessions">
            <Input
              id="pk-sessions"
              type="number"
              min={1}
              max={100}
              value={form.sessions}
              onChange={(e) => setForm({ ...form, sessions: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
            />
          </Field>
          <Field label="Harga paket" htmlFor="pk-price" hint={perSession ? `${rupiah(perSession)} per sesi` : undefined}>
            <MoneyInput id="pk-price" value={form.price} onChange={(price) => setForm({ ...form, price })} />
          </Field>
        </div>
        {form.sessions > 0 && <Beads total={form.sessions} used={0} />}
        <Field label="Berlaku untuk layanan" hint="Kosongkan agar bisa dipakai untuk semua layanan">
          <ServiceChips services={services} value={form.serviceIds} onChange={(serviceIds) => setForm({ ...form, serviceIds })} />
        </Field>
        <Field label="Masa berlaku" htmlFor="pk-valid" hint="Dihitung dari tanggal paket dibeli. Isi 0 hari jika tidak ada batas waktu.">
          <div className="flex flex-wrap gap-1.5">
            {VALIDITY_PRESETS.map(([days, label]) => (
              <button
                key={days}
                type="button"
                onClick={() => setForm({ ...form, validityDays: days })}
                aria-pressed={form.validityDays === days}
                className={cx(
                  "h-9 rounded-full border px-3 text-[13px] font-semibold transition-colors",
                  form.validityDays === days ? "border-jade bg-jade-mist text-jade-deep" : "border-line text-ink-2 hover:border-ink-2/30",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              id="pk-valid"
              type="number"
              min={0}
              className="max-w-32"
              value={form.validityDays}
              onChange={(e) => setForm({ ...form, validityDays: Math.max(0, Number(e.target.value) || 0) })}
            />
            <span className="text-sm text-muted">hari</span>
          </div>
        </Field>
        <div className="rounded-xl bg-canvas p-3.5">
          <Switch checked={form.active} onChange={(active) => setForm({ ...form, active })} label="Aktif, bisa dijual di checkout" />
        </div>
        {!isNew && (
          <p className="text-[13px] text-muted">
            Perubahan paket hanya berlaku untuk penjualan berikutnya. Voucher yang sudah dijual tidak berubah.
          </p>
        )}
      </div>
    </Sheet>
  );
}

/* ---------------- Discounts (manager) ---------------- */

const emptyDiscount: Discount = { name: "", type: "percent", value: 10, maxAmount: 0, appliesTo: "all", active: true, validUntil: null, note: "", createdAt: 0 };

export function DiscountForm({ value, onClose }: { value: Row<Discount> | "new" | null; onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useFormState<Discount>(value, emptyDiscount);
  const [busy, setBusy] = useState(false);
  const isNew = value === "new";
  const invalid = !form.name.trim() || form.value <= 0 || (form.type === "percent" && form.value > 100);
  const example = 300000;

  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title={isNew ? "Diskon baru" : "Ubah diskon"}
      footer={
        <Button
          size="lg"
          block
          loading={busy}
          disabled={invalid}
          onClick={async () => {
            setBusy(true);
            try {
              await saveDiscount(isNew ? null : (value as Row<Discount>).id, {
                ...form,
                name: form.name.trim(),
                note: form.note?.trim() ?? "",
                maxAmount: form.type === "percent" ? form.maxAmount || 0 : 0,
                createdAt: form.createdAt || Date.now(),
              });
              toast(isNew ? "Diskon dibuat. Front desk sudah bisa memakainya." : "Diskon disimpan");
              onClose();
            } catch (e) {
              toast(errorText(e), "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          Simpan diskon
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nama diskon" htmlFor="dc-name" hint="Terlihat di kasir, faktur, dan resi pasien.">
          <Input id="dc-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="mis. Member 10%, Promo Lebaran" />
        </Field>
        <Field label="Jenis">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["percent", "Persen (%)"],
                ["flat", "Potongan (Rp)"],
              ] as const
            ).map(([t, label]) => (
              <button
                key={t}
                type="button"
                aria-pressed={form.type === t}
                onClick={() => setForm({ ...form, type: t, value: t === "percent" ? 10 : 50000 })}
                className={cx(
                  "h-11 rounded-xl border text-sm font-semibold transition-colors",
                  form.type === t ? "border-jade bg-jade-mist/50 text-jade-deep ring-1 ring-jade" : "border-line hover:border-ink-2/30",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          {form.type === "percent" ? (
            <Field label="Besar diskon (%)" htmlFor="dc-val" error={form.value > 100 ? "Maksimal 100%" : undefined}>
              <Input id="dc-val" type="number" min={1} max={100} value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) || 0 })} />
            </Field>
          ) : (
            <Field label="Potongan" htmlFor="dc-val">
              <MoneyInput id="dc-val" value={form.value} onChange={(value) => setForm({ ...form, value })} />
            </Field>
          )}
          {form.type === "percent" && (
            <Field label="Maksimal potongan" htmlFor="dc-max" hint="Kosongkan jika tanpa batas">
              <MoneyInput id="dc-max" value={form.maxAmount ?? 0} onChange={(maxAmount) => setForm({ ...form, maxAmount })} />
            </Field>
          )}
        </div>
        <p className="rounded-xl bg-canvas px-4 py-3 text-sm text-ink-2">
          Contoh: item {rupiah(example)} dapat potongan{" "}
          <span className="font-bold text-jade-deep">{rupiah(discountAmount({ ...form, active: true }, example))}</span>.
        </p>
        <Field label="Berlaku untuk">
          <div className="grid gap-2">
            {(Object.keys(APPLIES_LABEL) as Discount["appliesTo"][]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={form.appliesTo === k}
                onClick={() => setForm({ ...form, appliesTo: k })}
                className={cx(
                  "rounded-xl border px-3.5 py-2.5 text-left text-sm font-semibold transition-colors",
                  form.appliesTo === k ? "border-jade bg-jade-mist/50 text-jade-deep ring-1 ring-jade" : "border-line hover:border-ink-2/30",
                )}
              >
                {APPLIES_LABEL[k]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Berlaku sampai (opsional)" htmlFor="dc-until" hint="Setelah tanggal ini diskon tidak muncul di kasir.">
          <Input id="dc-until" type="date" value={form.validUntil ?? ""} onChange={(e) => setForm({ ...form, validUntil: e.target.value || null })} />
        </Field>
        <Field label="Catatan (opsional)" htmlFor="dc-note">
          <Textarea id="dc-note" className="min-h-16" value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="mis. Untuk pasien lansia, tunjukkan KTP" />
        </Field>
        <div className="rounded-xl bg-canvas p-3.5">
          <Switch checked={form.active} onChange={(active) => setForm({ ...form, active })} label="Aktif, bisa dipakai di kasir" />
        </div>
      </div>
    </Sheet>
  );
}
