"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cx } from "./ui";

const PRESETS = [10, 25, 50];
const KEY = "jade-physio-page-size:";

/**
 * Rows per page for one list ("10", "25", "50" or any number the person types),
 * remembered per list in this browser. Resets to page 1 when the list changes.
 */
export function usePager<T>(rows: T[], id: string, initial = 10) {
  const [size, setSizeState] = useState(initial);
  const [page, setPage] = useState(0);
  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(KEY + id));
      if (saved > 0) setSizeState(saved);
    } catch {
      /* ignore */
    }
  }, [id]);
  const setSize = (n: number) => {
    const v = Math.max(1, Math.min(1000, Math.round(n) || initial));
    setSizeState(v);
    setPage(0);
    try {
      window.localStorage.setItem(KEY + id, String(v));
    } catch {
      /* ignore */
    }
  };
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pages - 1);
  // A shorter list (new filter, search) jumps back into range.
  useEffect(() => {
    if (page > pages - 1) setPage(pages - 1);
  }, [page, pages]);
  const shown = rows.slice(current * size, current * size + size);
  return { shown, size, setSize, page: current, setPage, pages, total: rows.length };
}

export function Pager({
  pager,
  className,
  label = "baris",
}: {
  pager: { size: number; setSize: (n: number) => void; page: number; setPage: (n: number) => void; pages: number; total: number };
  className?: string;
  label?: string;
}) {
  const { size, setSize, page, setPage, pages, total } = pager;
  const custom = !PRESETS.includes(size);
  const [typing, setTyping] = useState<string | null>(null);
  if (total <= PRESETS[0] && !custom && size === PRESETS[0]) return null;
  const from = total ? page * size + 1 : 0;
  const to = Math.min(total, (page + 1) * size);

  return (
    <div className={cx("flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[13px] text-muted", className)}>
      <div className="flex items-center gap-1.5">
        <span>Tampilkan</span>
        <div role="group" aria-label={`Jumlah ${label} per halaman`} className="inline-flex rounded-lg bg-line-soft p-0.5">
          {PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={size === n && typing === null}
              onClick={() => (setTyping(null), setSize(n))}
              className={cx(
                "tnum h-7 rounded-md px-2.5 font-semibold transition-colors",
                size === n && typing === null ? "bg-surface text-ink shadow-sm" : "hover:text-ink",
              )}
            >
              {n}
            </button>
          ))}
          {typing !== null || custom ? (
            <input
              type="number"
              min={1}
              max={1000}
              autoFocus={typing !== null}
              aria-label={`Jumlah ${label} sendiri`}
              value={typing ?? String(size)}
              onChange={(e) => setTyping(e.target.value)}
              onBlur={() => {
                if (typing) setSize(Number(typing));
                setTyping(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setTyping(null);
              }}
              className="tnum h-7 w-16 rounded-md bg-surface px-2 text-center !text-[13px] font-semibold text-ink shadow-sm outline-none focus:ring-2 focus:ring-jade/30"
            />
          ) : (
            <button type="button" onClick={() => setTyping("")} className="h-7 rounded-md px-2.5 font-semibold hover:text-ink">
              Atur…
            </button>
          )}
        </div>
        <span>{label}</span>
      </div>

      <div className="flex items-center gap-1">
        <span className="tnum mr-1">
          {from}–{to} dari {total}
        </span>
        <button
          type="button"
          aria-label="Halaman sebelumnya"
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
          className="flex size-8 items-center justify-center rounded-lg text-ink-2 hover:bg-line-soft disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="tnum min-w-12 text-center font-semibold text-ink-2">
          {page + 1}/{pages}
        </span>
        <button
          type="button"
          aria-label="Halaman berikutnya"
          disabled={page >= pages - 1}
          onClick={() => setPage(page + 1)}
          className="flex size-8 items-center justify-center rounded-lg text-ink-2 hover:bg-line-soft disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
