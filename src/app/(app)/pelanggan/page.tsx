"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, UserPlus, Users } from "lucide-react";
import { Avatar, Button, Empty, Input, PageHeader, Spinner } from "@/components/ui";
import { CustomerForm } from "@/components/CustomerForm";
import { useCollection, useCustomers } from "@/lib/hooks";
import { voucherState } from "@/lib/actions";
import { useCan } from "@/lib/auth";
import { remaining } from "@/lib/format";
import type { Voucher } from "@/lib/types";

export default function PelangganPage() {
  const { customers, loading } = useCustomers();
  const { rows: vouchers } = useCollection<Voucher>("vouchers", [["status", "==", "active"]]);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const can = useCan();

  const sessionsLeft = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of vouchers ?? []) if (voucherState(v) === "active") m.set(v.customerId, (m.get(v.customerId) ?? 0) + remaining(v));
    return m;
  }, [vouchers]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const digits = t.replace(/\D/g, "");
    if (!t) return customers;
    return customers.filter((c) => c.nameLower.includes(t) || (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)));
  }, [customers, q]);

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

        {loading ? (
          <Spinner />
        ) : list.length === 0 ? (
          <Empty
            icon={<Users className="size-5" />}
            title={q ? "Tidak ditemukan" : "Belum ada pelanggan"}
            body={q ? `Tidak ada pelanggan dengan nama atau nomor “${q}”.` : "Pelanggan akan muncul di sini setelah dicatat saat booking."}
          />
        ) : (
          <ul className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
            {list.map((c, i) => {
              const left = sessionsLeft.get(c.id) ?? 0;
              return (
                <li key={c.id} className={i ? "border-t border-line-soft" : ""}>
                  <Link href={`/pelanggan/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas">
                    <Avatar name={c.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{c.name}</p>
                      <p className="truncate text-[13px] text-muted">{c.phone || "Tanpa nomor"}</p>
                    </div>
                    {left > 0 && (
                      <span className="tnum shrink-0 rounded-full bg-jade-mist px-2.5 py-1 text-xs font-semibold text-jade-deep">
                        {left} sesi prabayar
                      </span>
                    )}
                    <ChevronRight className="size-4 shrink-0 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <div className="h-8" />
      </div>
      <CustomerForm open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
