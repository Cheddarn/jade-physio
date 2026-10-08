"use client";

import { useState } from "react";
import { Button, Field, Input, Sheet, Textarea, cx, errorText, useToast } from "./ui";
import { createCustomer, type CustomerInput } from "@/lib/actions";
import { GENDER_SHORT } from "@/lib/flow";
import { dateKey } from "@/lib/format";
import type { Gender } from "@/lib/types";

const EMPTY: CustomerInput = { name: "", phone: "", email: "", notes: "", birthDate: "", nik: "", address: "" };

/** A patient's basic data, the fields the clinic actually keeps: name, gender, phone, date of birth, KTP, address, notes. */
export function CustomerForm({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial?: CustomerInput;
  onSave?: (v: CustomerInput) => Promise<void>;
}) {
  const toast = useToast();
  const [form, setForm] = useState<CustomerInput>(initial ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setForm(initial ?? EMPTY);
  }
  const set = (k: keyof CustomerInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const nikDigits = (form.nik ?? "").replace(/\D/g, "");
  const nikError = nikDigits && nikDigits.length !== 16 ? "No. KTP (NIK) terdiri dari 16 angka." : undefined;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={initial ? "Ubah data pelanggan" : "Pelanggan baru"}
      footer={
        <Button
          size="lg"
          block
          loading={busy}
          disabled={!form.name.trim() || !!nikError}
          onClick={async () => {
            setBusy(true);
            try {
              if (onSave) await onSave(form);
              else await createCustomer(form);
              toast(initial ? "Data pelanggan disimpan" : "Pelanggan ditambahkan");
              onClose();
            } catch (e) {
              toast(errorText(e), "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          Simpan
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nama lengkap" htmlFor="c-name">
          <Input id="c-name" value={form.name} onChange={set("name")} autoFocus />
        </Field>
        <Field label="Jenis kelamin">
          {/* Tap the chosen one again to leave it empty. */}
          <div className="grid grid-cols-2 gap-2">
            {(["L", "P"] as Gender[]).map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={form.gender === g}
                onClick={() => setForm((f) => ({ ...f, gender: f.gender === g ? undefined : g }))}
                className={cx(
                  "h-11 rounded-xl border text-sm font-semibold transition-colors md:h-10",
                  form.gender === g ? "border-jade bg-jade-mist text-jade-deep ring-1 ring-jade" : "border-line text-ink-2 hover:border-ink-2/30",
                )}
              >
                {GENDER_SHORT[g]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="No. WhatsApp" htmlFor="c-phone">
          <Input id="c-phone" inputMode="tel" value={form.phone} onChange={set("phone")} placeholder="0812 3456 7890" />
        </Field>
        <Field label="Tanggal lahir" htmlFor="c-birth">
          <Input id="c-birth" type="date" max={dateKey()} value={form.birthDate ?? ""} onChange={set("birthDate")} />
        </Field>
        <Field label="No. KTP (NIK)" htmlFor="c-nik" error={nikError}>
          <Input id="c-nik" inputMode="numeric" maxLength={20} value={form.nik ?? ""} onChange={set("nik")} placeholder="16 angka" />
        </Field>
        <Field label="Alamat" htmlFor="c-address">
          <Textarea id="c-address" className="min-h-16" value={form.address ?? ""} onChange={set("address")} />
        </Field>
        <Field label="Catatan" htmlFor="c-notes">
          <Textarea id="c-notes" value={form.notes ?? ""} onChange={set("notes")} placeholder="mis. keluhan, riwayat cedera, alergi" />
        </Field>
        <Field label="Email (opsional)" htmlFor="c-email">
          <Input id="c-email" type="email" value={form.email ?? ""} onChange={set("email")} />
        </Field>
      </div>
    </Sheet>
  );
}
