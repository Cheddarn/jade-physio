"use client";

import { useMemo, useState } from "react";
import { Search, UserPlus, X } from "lucide-react";
import { Avatar, Button, Input, cx, errorText, useToast } from "./ui";
import { useCustomers } from "@/lib/hooks";
import { createCustomer } from "@/lib/actions";
import type { Row } from "@/lib/store";
import type { Customer } from "@/lib/types";

export function CustomerPicker({
  value,
  onChange,
  hint,
  autoFocus,
}: {
  value: Row<Customer> | null;
  onChange: (c: Row<Customer> | null) => void;
  hint?: (c: Row<Customer>) => React.ReactNode;
  autoFocus?: boolean;
}) {
  const { customers } = useCustomers();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return customers.slice(0, 6);
    const digits = t.replace(/\D/g, "");
    return customers
      .filter((c) => c.nameLower.includes(t) || (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)))
      .slice(0, 8);
  }, [q, customers]);

  if (value)
    return (
      <div className="flex items-center gap-3 rounded-xl border border-jade/40 bg-jade-mist/40 p-3">
        <Avatar name={value.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{value.name}</p>
          <p className="truncate text-[13px] text-muted">{value.phone || "Tanpa nomor"}</p>
          {hint && <div className="mt-1">{hint(value)}</div>}
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded-lg px-2 py-1 text-[13px] font-semibold text-jade hover:bg-jade-mist"
        >
          Ganti
        </button>
      </div>
    );

  if (adding)
    return (
      <div className="rounded-xl border border-line p-3">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">Pelanggan baru</p>
          <button type="button" onClick={() => setAdding(false)} className="text-muted hover:text-ink" aria-label="Batal">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex flex-col gap-2.5">
          <Input autoFocus placeholder="Nama lengkap" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            placeholder="No. WhatsApp, mis. 0812 3456 7890"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Button
            type="button"
            loading={busy}
            disabled={!name.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                const id = await createCustomer({ name, phone });
                onChange({ id, name: name.trim(), nameLower: name.trim().toLowerCase(), phone: phone.trim(), createdAt: Date.now() });
                toast("Pelanggan ditambahkan");
                setAdding(false);
                setName("");
                setPhone("");
              } catch (e) {
                toast(errorText(e), "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            Simpan pelanggan
          </Button>
        </div>
      </div>
    );

  return (
    <div className="rounded-xl border border-line">
      <div className="relative border-b border-line-soft">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama atau no. HP"
          className="h-11 w-full rounded-t-xl bg-transparent pr-3 pl-9 focus:outline-none"
        />
      </div>
      <ul className="max-h-56 overflow-y-auto py-1">
        {results.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onChange(c)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-canvas"
            >
              <Avatar name={c.name} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{c.name}</span>
                <span className="block truncate text-xs text-muted">{c.phone}</span>
              </span>
            </button>
          </li>
        ))}
        {results.length === 0 && <li className="px-3 py-3 text-sm text-muted">Tidak ada yang cocok dengan &ldquo;{q}&rdquo;.</li>}
      </ul>
      <button
        type="button"
        onClick={() => {
          setAdding(true);
          if (q && !/\d/.test(q)) setName(q);
          if (/\d{3,}/.test(q)) setPhone(q);
        }}
        className={cx("flex w-full items-center gap-2 border-t border-line-soft px-3 py-3 text-sm font-semibold text-jade hover:bg-jade-mist/50")}
      >
        <UserPlus className="size-4" />
        {q.trim() && !/\d/.test(q) ? `Tambah “${q.trim()}” sebagai pelanggan baru` : "Tambah pelanggan baru"}
      </button>
    </div>
  );
}

export function waLink(phone?: string, text?: string) {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  if (d.length < 9) return null;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
