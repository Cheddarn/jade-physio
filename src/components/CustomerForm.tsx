"use client";

import { useState } from "react";
import { Button, Field, Input, Sheet, Textarea, errorText, useToast } from "./ui";
import { createCustomer } from "@/lib/actions";

export function CustomerForm({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial?: { name: string; phone: string; email?: string; notes?: string };
  onSave?: (v: { name: string; phone: string; email?: string; notes?: string }) => Promise<void>;
}) {
  const toast = useToast();
  const [form, setForm] = useState(initial ?? { name: "", phone: "", email: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setForm(initial ?? { name: "", phone: "", email: "", notes: "" });
  }
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

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
          disabled={!form.name.trim()}
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
        <Field label="No. WhatsApp" htmlFor="c-phone">
          <Input id="c-phone" inputMode="tel" value={form.phone} onChange={set("phone")} placeholder="0812 3456 7890" />
        </Field>
        <Field label="Email (opsional)" htmlFor="c-email">
          <Input id="c-email" type="email" value={form.email ?? ""} onChange={set("email")} />
        </Field>
        <Field label="Catatan medis / keluhan" htmlFor="c-notes">
          <Textarea id="c-notes" value={form.notes ?? ""} onChange={set("notes")} placeholder="Riwayat cedera, alergi, dll." />
        </Field>
      </div>
    </Sheet>
  );
}
