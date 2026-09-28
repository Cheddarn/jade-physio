"use client";

import { useMemo, useState } from "react";
import { Search, Ticket } from "lucide-react";
import { Empty, Input, PageHeader, Segmented, Spinner } from "@/components/ui";
import { VoucherCard } from "@/components/Beads";
import { VoucherDetail } from "@/components/VoucherSheets";
import { useCollection } from "@/lib/hooks";
import { voucherState } from "@/lib/actions";
import { num, remaining, rupiah } from "@/lib/format";
import type { Voucher } from "@/lib/types";

type Filter = "active" | "used" | "expired" | "all";

export default function VoucherPage() {
  const { rows, loading } = useCollection<Voucher>("vouchers");
  const [filter, setFilter] = useState<Filter>("active");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const all = useMemo(() => [...(rows ?? [])].sort((a, b) => b.purchasedAt - a.purchasedAt), [rows]);
  const active = all.filter((v) => voucherState(v) === "active");
  const sessions = active.reduce((s, v) => s + remaining(v), 0);
  const liability = active.reduce((s, v) => s + (v.pricePaid / v.totalSessions) * remaining(v), 0);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all
      .filter((v) => {
        const st = voucherState(v);
        if (filter === "active") return st === "active";
        if (filter === "used") return st === "used";
        if (filter === "expired") return st === "expired" || st === "void";
        return true;
      })
      .filter((v) => !t || v.customerName.toLowerCase().includes(t) || v.code.toLowerCase().includes(t) || v.name.toLowerCase().includes(t));
  }, [all, filter, q]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Voucher" subtitle="Paket sesi yang sudah dibayar pelanggan" />
      <div className="px-4 md:px-8">
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          <Summary label="Voucher aktif" value={num(active.length)} />
          <Summary label="Sesi belum terpakai" value={num(sessions)} accent />
          <Summary label="Nilai prabayar tersisa" value={rupiah(liability)} />
        </div>

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
          <Segmented
            className="w-full md:w-auto"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "active", label: "Aktif" },
              { value: "used", label: "Habis" },
              { value: "expired", label: "Tidak berlaku" },
              { value: "all", label: "Semua" },
            ]}
          />
          <div className="relative md:ml-auto md:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari pelanggan atau kode" className="pl-10" />
          </div>
        </div>

        {loading ? (
          <Spinner />
        ) : list.length === 0 ? (
          <Empty
            icon={<Ticket className="size-5" />}
            title="Tidak ada voucher di sini"
            body="Voucher dibuat otomatis saat paket sesi dijual di checkout, atau ditambahkan manual dari halaman pelanggan."
          />
        ) : (
          <div className="mt-4 grid gap-3 pb-10 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((v) => (
              <VoucherCard key={v.id} v={v} onClick={() => setOpenId(v.id)} />
            ))}
          </div>
        )}
      </div>
      {openId && <VoucherDetail voucher={all.find((v) => v.id === openId) ?? null} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function Summary({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={accent ? "rounded-xl border border-jade/30 bg-jade-mist/50 px-3 py-3 md:px-4" : "rounded-xl border border-line bg-surface px-3 py-3 md:px-4"}>
      <p className="text-xs text-muted md:text-[13px]">{label}</p>
      <p className={`tnum mt-1 truncate text-[15px] font-bold md:text-xl ${accent ? "text-jade-deep" : ""}`}>{value}</p>
    </div>
  );
}
