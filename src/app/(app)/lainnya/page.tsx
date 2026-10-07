"use client";

import Link from "next/link";
import { ChevronRight, LogOut, Search, ShoppingBag } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { useAuth, useCan, useUser } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/firebase";
import { ROLE_LABEL } from "@/lib/roles";
import { DemoRoleSwitch } from "@/components/AppShell";
import { openSearch } from "@/components/CommandPalette";
import { NAV, NAV_GROUPS } from "@/lib/nav";
import { ClockCard } from "@/components/Attendance";

export default function LainnyaPage() {
  const user = useUser();
  const { signOut } = useAuth();
  const can = useCan();
  // Everything the bottom bar on phones has no room for.
  const visible = NAV.filter((n) => !n.cap || can(n.cap));
  const rest = visible.slice(4);
  const sections = [
    ...(can("checkout") ? [{ id: "aksi", label: "Aksi cepat", items: [{ href: "/checkout", label: "Transaksi baru", sub: "Jual layanan atau paket tanpa booking", icon: ShoppingBag }] }] : []),
    ...NAV_GROUPS.map((g) => ({ id: g.id, label: g.label, items: rest.filter((n) => n.group === g.id) })),
  ].filter((g) => g.items.length);
  return (
    <div className="mx-auto max-w-xl pb-10">
      <PageHeader title="Lainnya" />
      <div className="flex flex-col gap-4 px-4">
        <ClockCard />
        {user.role !== "patient" && (
          <button
            type="button"
            onClick={openSearch}
            className="flex h-12 items-center gap-3 rounded-xl border border-line bg-surface px-4 text-left text-muted active:bg-canvas"
          >
            <Search className="size-5" />
            Cari pasien, halaman, atau aksi…
          </button>
        )}
        {sections.map((g) => (
          <section key={g.id}>
            <h2 className="mb-2 px-1 text-[12px] font-bold tracking-wide text-muted uppercase">{g.label}</h2>
            <Card className="divide-y divide-line-soft">
              {g.items.map(({ href, label, sub, icon: Icon }) => (
                <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3.5 active:bg-canvas">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-jade-mist text-jade">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{label}</span>
                    {sub && <span className="block truncate text-[13px] text-muted">{sub}</span>}
                  </span>
                  <ChevronRight className="size-4 text-muted" />
                </Link>
              ))}
            </Card>
          </section>
        ))}

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
