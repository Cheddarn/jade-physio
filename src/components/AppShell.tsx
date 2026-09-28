"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  CalendarDays,
  ChartColumn,
  Ellipsis,
  LayoutGrid,
  LogOut,
  ReceiptText,
  ShoppingBag,
  Ticket,
  UserCog,
  Users,
} from "lucide-react";
import { cx } from "./ui";
import { useAuth, useCan, useUser } from "@/lib/auth";
import { ROLES, ROLE_LABEL, type Cap, type Role } from "@/lib/roles";
import { DEMO_MODE } from "@/lib/firebase";
import { BUSINESS } from "@/lib/format";

export const NAV: { href: string; label: string; icon: typeof CalendarDays; cap?: Cap }[] = [
  { href: "/kalender", label: "Kalender", icon: CalendarDays },
  { href: "/pelanggan", label: "Pelanggan", icon: Users },
  { href: "/voucher", label: "Voucher", icon: Ticket, cap: "vouchers.view" },
  { href: "/faktur", label: "Faktur", icon: ReceiptText, cap: "sales.view" },
  { href: "/laporan", label: "Laporan", icon: ChartColumn, cap: "reports" },
  { href: "/katalog", label: "Katalog", icon: LayoutGrid, cap: "catalog" },
  { href: "/tim", label: "Terapis & akses", icon: UserCog, cap: "team" },
];

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <circle cx="14" cy="14" r="12.5" fill="none" stroke="var(--color-jade)" strokeWidth="3" />
        <circle cx="14" cy="14" r="5" fill="var(--color-jade-bead)" />
      </svg>
      <span className="text-[17px] font-bold tracking-[-0.01em]">{BUSINESS.name}</span>
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const user = useUser();
  const can = useCan();
  const { signOut } = useAuth();
  const nav = NAV.filter((n) => !n.cap || can(n.cap));
  const mobileNav = nav.slice(0, 4);
  const active = (href: string) => path === href || path.startsWith(href + "/");
  const moreActive = !mobileNav.some((n) => active(n.href)) && !active("/checkout");
  const tabCols = mobileNav.length + 1;

  return (
    <div className="min-h-dvh md:pl-[232px] print:!pl-0">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-line bg-surface md:flex">
        <div className="px-5 pt-5 pb-4">
          <Logo />
        </div>
        {can("checkout") && (
        <div className="px-3 pb-3">
          <Link
            href="/checkout"
            className="flex h-10 items-center justify-center gap-2 rounded-[10px] border border-line text-sm font-semibold text-ink hover:border-jade/50 hover:bg-jade-mist/50"
          >
            <ShoppingBag className="size-4 text-jade" />
            Transaksi baru
          </Link>
        </div>
        )}
        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cx(
                "flex h-10 items-center gap-3 rounded-[10px] px-3 text-sm font-semibold transition-colors",
                active(href) ? "bg-jade-mist text-jade-deep" : "text-ink-2 hover:bg-line-soft hover:text-ink",
              )}
            >
              <Icon className="size-[18px]" strokeWidth={active(href) ? 2.4 : 2} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line-soft p-3">
          {DEMO_MODE && <DemoRoleSwitch className="mb-2" />}
          <div className="flex items-center gap-2.5 rounded-[10px] px-2 py-1.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted">{ROLE_LABEL[user.role]}</p>
            </div>
            <button
              onClick={signOut}
              aria-label="Keluar"
              title="Keluar"
              className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-line-soft hover:text-ink"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="pb-[calc(72px+var(--safe-bottom))] md:pb-0 print:!pb-0">{children}</main>

      {/* Mobile tab bar */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[var(--safe-bottom)] backdrop-blur md:hidden">
        <div className="grid h-[64px]" style={{ gridTemplateColumns: `repeat(${tabCols}, minmax(0, 1fr))` }}>
          {mobileNav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cx(
                "flex flex-col items-center justify-center gap-1 text-[11px] font-semibold",
                active(href) ? "text-jade-deep" : "text-muted",
              )}
            >
              <span className={cx("flex h-7 w-12 items-center justify-center rounded-full", active(href) && "bg-jade-mist")}>
                <Icon className="size-5" strokeWidth={active(href) ? 2.4 : 2} />
              </span>
              {label}
            </Link>
          ))}
          <Link
            href="/lainnya"
            className={cx(
              "flex flex-col items-center justify-center gap-1 text-[11px] font-semibold",
              moreActive ? "text-jade-deep" : "text-muted",
            )}
          >
            <span className={cx("flex h-7 w-12 items-center justify-center rounded-full", moreActive && "bg-jade-mist")}>
              <Ellipsis className="size-5" />
            </span>
            Lainnya
          </Link>
        </div>
      </nav>
    </div>
  );
}

/** Demo mode only: preview the app as each role. */
export function DemoRoleSwitch({ className }: { className?: string }) {
  const user = useUser();
  const { setDemoRole } = useAuth();
  return (
    <div className={cx("rounded-lg bg-amber-mist px-3 py-2", className)}>
      <p className="text-xs font-semibold text-amber">Mode demo: lihat sebagai</p>
      <div className="mt-1.5 flex gap-1">
        {ROLES.map((r: Role) => (
          <button
            key={r}
            onClick={() => setDemoRole(r)}
            aria-pressed={user.role === r}
            className={cx(
              "h-7 flex-1 rounded-md px-1 text-[11px] font-semibold whitespace-nowrap transition-colors",
              user.role === r ? "bg-surface text-ink shadow-sm" : "text-amber hover:bg-surface/60",
            )}
          >
            {r === "staff" ? "Kasir" : ROLE_LABEL[r]}
          </button>
        ))}
      </div>
    </div>
  );
}
