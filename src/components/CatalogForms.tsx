"use client";

import { useState } from "react";
import { Button, Field, Input, MoneyInput, Sheet, Switch, Textarea, errorText, useToast } from "./ui";
import { Beads } from "./Beads";
import { ServiceChips } from "./VoucherSheets";
import { savePackage, saveService } from "@/lib/actions";
import { rupiah } from "@/lib/format";
import type { Row } from "@/lib/store";
import type { Package, Service } from "@/lib/types";

const emptyService: Service = { name: "", durationMin: 60, price: 0, description: "", active: true };
const emptyPackage: Package = { name: "", sessions: 5, price: 0, serviceIds: [], validityDays: 90, active: true };

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
        <Field label="Masa berlaku (hari)" htmlFor="pk-valid" hint="Isi 0 jika tidak ada batas waktu">
          <Input
            id="pk-valid"
            type="number"
            min={0}
            value={form.validityDays}
            onChange={(e) => setForm({ ...form, validityDays: Math.max(0, Number(e.target.value) || 0) })}
          />
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
