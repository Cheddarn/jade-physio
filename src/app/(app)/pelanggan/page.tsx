"use client";

import { Pager, usePager } from "@/components/Pager";
import { useMemo, useState } from "react";
import Link from "next/link";
import { BellRing, Check, ChevronRight, MessageCircle, Search, UserPlus, Users } from "lucide-react";
import { Avatar, Badge, Button, Empty, Input, PageHeader, Select, Spinner, cx, errorText, useToast } from "@/components/ui";
import { CustomerForm } from "@/components/CustomerForm";
import { waLink } from "@/components/CustomerPicker";
import { useCollection, useCustomers } from "@/lib/hooks";
import { voucherState } from "@/lib/actions";
import { useCan } from "@/lib/auth";
import { BUSINESS, daysUntil, remaining, shortDate } from "@/lib/format";
import { saveSettings, useSettings } from "@/lib/settings";
import { store, type Row } from "@/lib/store";
import type { Customer, Voucher } from "@/lib/types";

type Filter = "semua" | "prabayar" | "expiring" | "formulir";

const WINDOWS: [number, string][] = [
  [3, "3 hari"],
  [7, "1 minggu"],
  [14, "2 minggu"],
  [30, "1 bulan"],
  [60, "2 bulan"],
];

export default function PelangganPage() {
  const { customers, loading } = useCustomers();
  const { rows: vouchers } = useCollection<Voucher>("vouchers", [["status", "==", "active"]]);
  const { settings } = useSettings();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("semua");
  const [windowDays, setWindowDays] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const can = useCan();
  const toast = useToast();
  const days = windowDays ?? settings.reminderDays;

  const active = useMemo(() => (vouchers ?? []).filter((v) => voucherState(v) === "active"), [vouchers]);
  const sessionsLeft = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of active) m.set(v.customerId, (m.get(v.customerId) ?? 0) + remaining(v));
    return m;
  }, [active]);
  /** Packages with sessions left that run out within the reminder window. */
  const expiring = useMemo(() => {
    const until = Date.now() + days * 86_400_000;
    return active.filter((v) => v.expiresAt != null && v.expiresAt <= until).sort((a, b) => a.expiresAt! - b.expiresAt!);
  }, [active, days]);
  const expiringBy = useMemo(() => {
    const m = new Map<string, Row<Voucher>[]>();
    for (const v of expiring) m.set(v.customerId, [...(m.get(v.customerId) ?? []), v]);
    return m;
  }, [expiring]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const digits = t.replace(/\D/g, "");
    let rows = customers;
    if (filter === "prabayar") rows = rows.filter((c) => (sessionsLeft.get(c.id) ?? 0) > 0);
    if (filter === "expiring")
      rows = rows.filter((c) => expiringBy.has(c.id)).sort((a, b) => expiringBy.get(a.id)![0].expiresAt! - expiringBy.get(b.id)![0].expiresAt!);
    if (filter === "formulir") rows = rows.filter((c) => !c.profile);
    if (!t) return rows;
    return rows.filter((c) => c.nameLower.includes(t) || (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)));
  }, [customers, q, filter, sessionsLeft, expiringBy]);

  const pager = usePager(list, "pelanggan", 25);

  const chips: [Filter, string, number | null][] = [
    ["semua", "Semua", null],
    ["prabayar", "Punya sesi prabayar", sessionsLeft.size],
    ["expiring", "Paket hampir kedaluwarsa", expiringBy.size],
    ["formulir", "Belum isi formulir", customers.filter((c) => !c.profile).length],
  ];

  async function remind(c: Row<Customer>, vs: Row<Voucher>[]) {
    const lines = vs.map((v) => `- ${v.name}: sisa ${remaining(v)} sesi, berlaku sampai ${shortDate(v.expiresAt!)}`).join("\n");
    const text = `Halo ${c.name.split(" ")[0]}, kami dari ${BUSINESS.name} ingin mengingatkan paket sesi Anda akan segera berakhir:\n${lines}\n\nYuk jadwalkan sesi berikutnya. Balas pesan ini untuk booking. Terima kasih!`;
    const url = waLink(c.phone, text);
    if (url) window.open(url, "_blank", "noopener");
    try {
      await Promise.all(vs.map((v) => store.update("vouchers", v.id, { remindedAt: Date.now() })));
      if (!url) toast("Nomor WhatsApp tidak ada. Ditandai sudah diingatkan.");
    } catch (e) {
      toast(errorText(e), "error");
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Pelanggan"
        subtitle={`${customers.length} pelanggan terdaftar`}
        actions={
          can("customers.edit") && (
            <Button icon={<UserPlus className="size-4" />} onClick={() => setAdding(true)}>
              <span className="hidden sm:inline">Pelanggan baru</span>
              <span className="sm:hidden">Baru</span>
            </Button>
          )
        }
      />
      <div className="px-4 md:px-8">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau no. HP" className="pl-10" />
        </div>

        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {chips.map(([key, label, n]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={cx(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
                filter === key ? "border-jade bg-jade-mist text-jade-deep" : "border-line bg-surface text-ink-2 hover:border-ink-2/30",
              )}
            >
              {key === "expiring" && <BellRing className="size-3.5" />}
              {label}
              {n != null && (
                <span className={cx("tnum rounded-full px-1.5 text-xs", key === "expiring" && n > 0 ? "bg-amber text-white" : "bg-line-soft")}>{n}</span>
              )}
            </button>
          ))}
        </div>

        {filter === "expiring" && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-amber-mist px-4 py-3 text-sm text-amber">
            <span className="font-semibold">Ingatkan pasien</span>
            <Select
              aria-label="Berapa hari sebelum kedaluwarsa"
              className="!h-9 !w-auto bg-surface text-sm"
              value={days}
              onChange={(e) => setWindowDays(Number(e.target.value))}
            >
              {[...new Set([...WINDOWS.map(([d]) => d), settings.reminderDays])].sort((a, b) => a - b).map((d) => (
                <option key={d} value={d}>
                  {WINDOWS.find(([x]) => x === d)?.[1] ?? `${d} hari`}
                </option>
              ))}
            </Select>
            <span>sebelum paket kedaluwarsa.</span>
            {can("attendance.manage") && days !== settings.reminderDays && (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  try {
                    await saveSettings({ reminderDays: days });
                    setWindowDays(null);
                    toast("Jadi pengaturan bawaan untuk semua staf");
                  } catch (e) {
                    toast(errorText(e), "error");
                  }
                }}
              >
                Jadikan bawaan
              </Button>
            )}
          </div>
        )}

        {loading ? (
          <Spinner />
        ) : list.length === 0 ? (
          <Empty
            icon={<Users className="size-5" />}
            title={q ? "Tidak ditemukan" : filter === "expiring" ? "Tidak ada paket yang hampir kedaluwarsa" : "Belum ada pelanggan"}
            body={
              q
                ? `Tidak ada pelanggan dengan nama atau nomor “${q}”.`
                : filter === "expiring"
                  ? "Coba perpanjang rentang waktunya."
                  : "Pelanggan akan muncul di sini setelah dicatat saat booking."
            }
          />
        ) : (
          <ul className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
            {pager.shown.map((c, i) => {
              const left = sessionsLeft.get(c.id) ?? 0;
              const exp = filter === "expiring" ? expiringBy.get(c.id) ?? [] : [];
              return (
                <li key={c.id} className={i ? "border-t border-line-soft" : ""}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-canvas">
                    <Link href={`/pelanggan/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar name={c.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{c.name}</p>
                        <p className="truncate text-[13px] text-muted">{c.phone || "Tanpa nomor"}</p>
                        {exp.map((v) => {
                          const d = daysUntil(v.expiresAt!);
                          return (
                            <p key={v.id} className="mt-0.5 text-[13px]">
                              <span className="font-semibold">{v.name}</span>
                              <span className={cx("ml-1.5 font-semibold", d <= 3 ? "text-danger" : "text-amber")}>
                                {d < 0 ? "sudah lewat" : d === 0 ? "habis hari ini" : `habis ${shortDate(v.expiresAt!)} (${d} hari lagi)`}
                              </span>
                              <span className="text-muted">, sisa {remaining(v)} sesi</span>
                              {v.remindedAt && (
                                <span className="ml-1.5 inline-flex items-center gap-0.5 text-jade-deep">
                                  <Check className="size-3" />
                                  diingatkan {shortDate(v.remindedAt)}
                                </span>
                              )}
                            </p>
                          );
                        })}
                      </div>
                    </Link>
                    {filter === "expiring" ? (
                      <Button
                        size="sm"
                        variant={exp.some((v) => v.remindedAt) ? "secondary" : "primary"}
                        icon={<MessageCircle className="size-3.5" />}
                        onClick={() => remind(c, exp)}
                      >
                        Ingatkan
                      </Button>
                    ) : (
                      <>
                        {!c.profile && filter !== "formulir" && <Badge tone="amber" className="hidden sm:inline-flex">Formulir belum</Badge>}
                        {left > 0 && (
                          <span className="tnum shrink-0 rounded-full bg-jade-mist px-2.5 py-1 text-xs font-semibold text-jade-deep">
                            {left} sesi prabayar
                          </span>
                        )}
                        <ChevronRight className="size-4 shrink-0 text-muted" />
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {!loading && list.length > 0 && <Pager pager={pager} label="pelanggan" className="mt-3" />}
        <div className="h-8" />
      </div>
      <CustomerForm open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
