"use client";

import { cx } from "./ui";
import { remaining, shortDate } from "@/lib/format";
import { voucherState } from "@/lib/actions";
import type { Voucher } from "@/lib/types";

/**
 * Sessions drawn as a string of jade beads: filled beads are sessions still
 * available, hollow ones have been used. Long packages collapse to a bar.
 */
export function Beads({
  total,
  used,
  size = 12,
  pending = 0,
  className,
}: {
  total: number;
  used: number;
  size?: number;
  /** sessions about to be used in the current checkout */
  pending?: number;
  className?: string;
}) {
  const left = Math.max(0, total - used);
  if (total > 12) {
    const pct = (left / total) * 100;
    return (
      <div className={cx("h-2.5 w-full overflow-hidden rounded-full bg-line-soft", className)}>
        <div className="h-full rounded-full bg-jade-bead" style={{ width: `${pct}%` }} />
      </div>
    );
  }
  return (
    <div className={cx("flex flex-wrap items-center gap-[5px]", className)} aria-label={`${left} dari ${total} sesi tersisa`}>
      {Array.from({ length: total }, (_, i) => {
        const isLeft = i < left;
        const isPending = isLeft && i >= left - pending;
        return (
          <span
            key={i}
            className="rounded-full transition-colors"
            style={{
              width: size,
              height: size,
              background: isPending
                ? "repeating-linear-gradient(-45deg, var(--color-jade-bead) 0 2px, var(--color-jade-mist) 2px 4px)"
                : isLeft
                  ? "radial-gradient(circle at 35% 30%, #5fc79f 0, var(--color-jade-bead) 45%, var(--color-jade-deep) 100%)"
                  : "transparent",
              boxShadow: isLeft ? "inset 0 -1px 1px rgb(0 0 0 / 0.15)" : "inset 0 0 0 1.5px var(--color-line)",
            }}
          />
        );
      })}
    </div>
  );
}

export function VoucherCard({
  v,
  onClick,
  compact,
  action,
}: {
  v: Voucher & { id: string };
  onClick?: () => void;
  compact?: boolean;
  action?: React.ReactNode;
}) {
  const state = voucherState(v);
  const left = remaining(v);
  const dim = state !== "active";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cx(
        "group w-full rounded-xl border bg-surface p-4 text-left transition-colors",
        dim ? "border-line-soft" : "border-line",
        onClick && "hover:border-jade/50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cx("truncate font-semibold", dim && "text-muted")}>{v.name}</p>
          {!compact && <p className="mt-0.5 truncate text-[13px] text-muted">{v.customerName}</p>}
        </div>
        {state === "active" ? (
          <span className="tnum shrink-0 text-right">
            <span className="text-[22px] font-bold leading-none text-jade-deep">{left}</span>
            <span className="text-[13px] text-muted">/{v.totalSessions}</span>
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-line-soft px-2.5 py-1 text-xs font-semibold text-muted">
            {state === "used" ? "Habis" : state === "expired" ? "Kedaluwarsa" : "Dibatalkan"}
          </span>
        )}
      </div>
      <Beads total={v.totalSessions} used={v.usedSessions} className="mt-3" />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px] text-muted">
        <span className="font-semibold tracking-wide text-ink-2">{v.code}</span>
        <span>{v.expiresAt ? `Berlaku s.d. ${shortDate(v.expiresAt)}` : "Tanpa batas waktu"}</span>
      </div>
      {action}
    </Tag>
  );
}
