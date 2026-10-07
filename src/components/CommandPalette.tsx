"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { BellRing, CalendarPlus, CornerDownLeft, PackagePlus, Search, ShoppingBag, User, UserPlus } from "lucide-react";
import { cx } from "./ui";
import { NAV } from "@/lib/nav";
import { useCan } from "@/lib/auth";
import { useCollection } from "@/lib/hooks";
import type { Cap } from "@/lib/roles";
import type { Customer } from "@/lib/types";

const OPEN_EVENT = "jade-physio:search";

/** Opens the quick search from anywhere (buttons, the Lainnya page). */
export const openSearch = () => window.dispatchEvent(new Event(OPEN_EVENT));

type Item = { id: string; group: string; label: string; sub?: string; icon: ReactNode; href: string };

const ACTIONS: { label: string; sub: string; href: string; cap: Cap; icon: ReactNode; words: string }[] = [
  { label: "Pasien datang", sub: "Catat pasien walk-in", href: "/alur?baru=1", cap: "flow.manage", icon: <UserPlus className="size-4" />, words: "walk in check in datang daftar" },
  { label: "Booking baru", sub: "Buat jadwal terapi", href: "/kalender?baru=1", cap: "bookings.manage", icon: <CalendarPlus className="size-4" />, words: "jadwal janji appointment" },
  { label: "Transaksi baru", sub: "Checkout layanan atau paket", href: "/checkout", cap: "checkout", icon: <ShoppingBag className="size-4" />, words: "bayar kasir jual paket checkout" },
  { label: "Pengingat jadwal besok", sub: "Kirim WhatsApp ke pasien", href: "/kalender?pengingat=1", cap: "bookings.manage", icon: <BellRing className="size-4" />, words: "reminder wa whatsapp ingatkan" },
  { label: "Ajukan restock", sub: "Barang hampir habis", href: "/restock", cap: "restock", icon: <PackagePlus className="size-4" />, words: "barang habis beli stok" },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const digits = (s: string) => s.replace(/\D/g, "");

/** Ctrl+K (or / outside a text field): jump to a patient, a page or a common action. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);
  if (!open || typeof document === "undefined") return null;
  return createPortal(<Palette onClose={() => setOpen(false)} />, document.body);
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const can = useCan();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const { rows: customers } = useCollection<Customer>(can("customers.view") ? "customers" : null);

  useEffect(() => {
    input.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const items = useMemo<Item[]>(() => {
    const t = norm(q.trim());
    const num = digits(q);
    const has = (...parts: (string | undefined)[]) => !t || parts.some((p) => p && norm(p).includes(t));
    const actions = ACTIONS.filter((a) => can(a.cap) && has(a.label, a.sub, a.words)).map((a) => ({
      id: `a:${a.href}`,
      group: "Aksi cepat",
      label: a.label,
      sub: a.sub,
      icon: a.icon,
      href: a.href,
    }));
    const pages = NAV.filter((n) => (!n.cap || can(n.cap)) && has(n.label, n.sub)).map((n) => {
      const Icon = n.icon;
      return { id: `p:${n.href}`, group: "Halaman", label: n.label, sub: n.sub, icon: <Icon className="size-4" />, href: n.href };
    });
    const people = !t
      ? []
      : (customers ?? [])
          .filter((c) => norm(c.name).includes(t) || (num.length >= 3 && digits(c.phone).includes(num)) || (c.profile?.medicalRecordNo && norm(c.profile.medicalRecordNo).includes(t)))
          .sort((a, b) => Number(!norm(a.name).startsWith(t)) - Number(!norm(b.name).startsWith(t)) || a.name.localeCompare(b.name))
          .slice(0, 8)
          .map((c) => ({
            id: `c:${c.id}`,
            group: "Pasien",
            label: c.name,
            sub: [c.phone, c.profile?.medicalRecordNo].filter(Boolean).join(" · "),
            icon: <User className="size-4" />,
            href: `/pelanggan/${c.id}`,
          }));
    // Typing a name: patients first. Empty box: actions and pages.
    return t ? [...people, ...actions, ...pages] : [...actions, ...pages];
  }, [q, customers, can]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(item?: Item) {
    if (!item) return;
    onClose();
    router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") return onClose();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(items[active]);
    }
  }

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-ink/30 px-3 pt-[max(12px,var(--safe-top))] backdrop-blur-[2px] md:pt-[12vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cari"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="flex max-h-[min(560px,80dvh)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-sheet)]"
      >
        <div className="flex items-center gap-3 border-b border-line-soft px-4">
          <Search className="size-5 shrink-0 text-muted" />
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={items[active] ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={can("customers.view") ? "Cari pasien, no. HP, halaman, atau aksi…" : "Cari halaman atau aksi…"}
            className="h-14 min-w-0 flex-1 bg-transparent text-[16px] placeholder:text-muted"
            // The whole dialog is the focus context; the global focus ring would box the text.
            style={{ outline: "none" }}
          />
          <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 text-[11px] font-semibold text-muted md:inline">Esc</kbd>
        </div>
        <ul ref={list} id={listId} role="listbox" aria-label="Hasil" className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
          {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">Tidak ada yang cocok dengan “{q}”.</li>}
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <li key={it.id} role="presentation">
                {header && <p className="px-3 pt-2.5 pb-1 text-[11px] font-bold tracking-wide text-muted uppercase">{header}</p>}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  data-i={i}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(it)}
                  className={cx("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5", i === active ? "bg-jade-mist" : "")}
                >
                  <span className={cx("flex size-8 shrink-0 items-center justify-center rounded-lg", i === active ? "bg-surface text-jade" : "bg-line-soft text-ink-2")}>
                    {it.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{it.label}</span>
                    {it.sub && <span className="block truncate text-[12px] text-muted">{it.sub}</span>}
                  </span>
                  {i === active && <CornerDownLeft className="hidden size-4 shrink-0 text-jade md:block" />}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="hidden border-t border-line-soft px-4 py-2 text-[12px] text-muted md:block">
          <b>↑ ↓</b> pilih · <b>Enter</b> buka · <b>Ctrl K</b> atau <b>/</b> dari mana saja
        </p>
      </div>
    </div>
  );
}

/** The search box look-alike in the sidebar. */
export function SearchButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openSearch}
      className={cx(
        "flex h-10 w-full items-center gap-2.5 rounded-[10px] border border-line bg-canvas/60 px-3 text-left text-sm text-muted transition-colors hover:border-ink-2/30 hover:text-ink",
        className,
      )}
    >
      <Search className="size-4" />
      <span className="flex-1">Cari…</span>
      <kbd className="rounded border border-line bg-surface px-1.5 text-[11px] font-semibold">Ctrl K</kbd>
    </button>
  );
}
