"use client";

import Link from "next/link";
import { ChartColumn, ChevronRight, LayoutGrid, LogOut, ShoppingBag, UserCog } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { useAuth, useCan, useUser } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/firebase";
import { ROLE_LABEL, type Cap } from "@/lib/roles";
import { DemoRoleSwitch } from "@/components/AppShell";

const ITEMS: { href: string; label: string; sub: string; icon: typeof ShoppingBag; cap: Cap }[] = [
  { href: "/checkout", label: "Transaksi baru", sub: "Jual layanan atau paket tanpa booking", icon: ShoppingBag, cap: "checkout" },
  { href: "/laporan", label: "Laporan penjualan", sub: "Pemasukan, metode bayar, per terapis", icon: ChartColumn, cap: "reports" },
  { href: "/katalog", label: "Katalog", sub: "Layanan dan paket sesi", icon: LayoutGrid, cap: "catalog" },
  { href: "/tim", label: "Terapis & akses", sub: "Kolom kalender dan akun login", icon: UserCog, cap: "team" },
];

export default function LainnyaPage() {
  const user = useUser();
  const { signOut } = useAuth();
  const can = useCan();
  const items = ITEMS.filter((i) => can(i.cap));
  return (
    <div className="mx-auto max-w-xl pb-10">
      <PageHeader title="Lainnya" />
      <div className="flex flex-col gap-4 px-4">
        {items.length > 0 && (
        <Card className="divide-y divide-line-soft">
          {items.map(({ href, label, sub, icon: Icon }) => (
            <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3.5 active:bg-canvas">
              <span className="flex size-10 items-center justify-center rounded-xl bg-jade-mist text-jade">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{label}</span>
                <span className="block truncate text-[13px] text-muted">{sub}</span>
              </span>
              <ChevronRight className="size-4 text-muted" />
            </Link>
          ))}
        </Card>
        )}

        <Card className="flex items-center gap-3 px-4 py-3.5">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{user.name}</span>
            <span className="block truncate text-[13px] text-muted">
              {ROLE_LABEL[user.role]}, {user.email}
            </span>
          </span>
          <button onClick={signOut} className="flex h-10 items-center gap-2 rounded-[10px] px-3 text-sm font-semibold text-danger hover:bg-danger-mist">
            <LogOut className="size-4" />
            Keluar
          </button>
        </Card>
        {DEMO_MODE && (
          <>
            <DemoRoleSwitch />
            <p className="text-[13px] text-muted">Mode demo: semua data adalah contoh dan tersimpan di browser ini saja.</p>
          </>
        )}
      </div>
    </div>
  );
}
