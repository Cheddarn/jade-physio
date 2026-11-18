"use client";

import { cx } from "./ui";

/* A row of tabs over a pick-list, each with how many of its picks are chosen. Same file in both apps. */

export function PickTabs<T extends string>({
  label,
  tabs,
  active,
  onChange,
}: {
  label: string;
  tabs: { id: T; name: string; count: number }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    // Tabs keep their full names and share the row; on a narrow phone they wrap rather than cut words off.
    <div role="group" aria-label={label} className="flex flex-wrap gap-1 rounded-lg bg-canvas p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={active === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            "flex h-8 grow items-center justify-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors",
            active === t.id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          <span>{t.name}</span>
          {t.count > 0 && <span className="tnum shrink-0 rounded-full bg-jade px-1.5 text-[11px] leading-[18px] text-white">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
