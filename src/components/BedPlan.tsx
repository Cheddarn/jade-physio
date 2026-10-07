"use client";

import { BEDS, ROOMS, groupText, type Bed, type VisitRow } from "@/lib/flow";
import { groupColor } from "@/lib/relations";
import { staffColor } from "@/lib/format";
import type { Row } from "@/lib/store";
import type { Staff } from "@/lib/types";
import { cx } from "./ui";

export type BedTone = "free" | "reserved" | "session";

export const bedTone = (v?: VisitRow): BedTone => (!v ? "free" : v.stage === "in_session" ? "session" : "reserved");

export const minutesSince = (from: number | null | undefined, now: number) =>
  from ? Math.max(0, Math.round((now - from) / 60_000)) : 0;

const short = (name: string) => name.split(/\s+/).slice(0, 2).join(" ");

/** The little card above (3D) or inside (plan) each bed. */
export function BedLabel({
  bed,
  visit,
  staff,
  now,
  compact,
  onClick,
  className,
}: {
  bed: Bed;
  visit?: VisitRow;
  staff: Row<Staff>[];
  now: number;
  compact?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const tone = bedTone(visit);
  const st = staff.find((s) => s.id === visit?.staffId);
  const c = staffColor(st?.color);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "block rounded-lg border-l-[3px] bg-white/95 px-2 py-1 text-left leading-tight whitespace-nowrap shadow-[var(--shadow-lift)] transition-transform hover:scale-105",
        compact ? "text-[10px]" : "text-[11px]",
        className,
      )}
      style={{ borderLeftColor: tone === "free" ? "var(--color-line)" : tone === "reserved" ? "#d2921b" : c.dot }}
    >
      <span className="flex items-center gap-1 font-bold text-ink">
        {tone === "session" && <span className="pulse-dot size-1.5 rounded-full" style={{ background: c.dot }} />}
        {bed.label}
        <span className="font-semibold text-muted">
          {tone === "free" ? "kosong" : tone === "reserved" ? "menunggu" : `${minutesSince(visit?.startedAt, now)} mnt`}
        </span>
      </span>
      {visit && (
        <>
          <span className="block font-semibold text-ink">{compact ? visit.customerName.split(/\s+/)[0] : short(visit.customerName)}</span>
          <span className="flex items-center gap-1 text-ink-2">
            <span className="size-1.5 rounded-full" style={{ background: c.dot }} />
            {visit.staffName ?? "Belum ada terapis"}
          </span>
          {visit.groupId && <GroupLine v={visit} />}
        </>
      )}
    </button>
  );
}

/** Flat floor plan: same rooms and beds, no 3D needed. */
export function BedPlan({
  occupancy,
  staff,
  now,
  onPick,
}: {
  occupancy: Map<string, VisitRow>;
  staff: Row<Staff>[];
  now: number;
  onPick: (bedId: string) => void;
}) {
  return (
    <div className="grid h-full gap-3 overflow-auto p-3 sm:grid-cols-[5fr_2fr]">
      {ROOMS.map((room) => {
        const beds = BEDS.filter((b) => b.room === room.id);
        return (
          <div key={room.id} className="rounded-xl border-2 border-line bg-[#f6f2ea] p-2.5">
            <p className="mb-2 text-xs font-bold text-jade-deep">{room.name}</p>
            {/* Phones fit three beds a row so names stay readable. */}
            <div className={cx("grid gap-2", beds.length > 3 ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-2")}>
              {beds.map((bed) => {
                const v = occupancy.get(bed.id);
                const tone = bedTone(v);
                const st = staff.find((s) => s.id === v?.staffId);
                const c = staffColor(st?.color);
                return (
                  <button
                    key={bed.id}
                    type="button"
                    onClick={() => onPick(bed.id)}
                    className="flex min-h-28 flex-col rounded-lg border p-1.5 text-left text-[11px] leading-tight transition-shadow hover:shadow-[var(--shadow-lift)]"
                    style={{
                      background: tone === "free" ? "#fff" : tone === "reserved" ? "#fbebcb" : c.bg,
                      borderColor: tone === "free" ? "var(--color-line)" : tone === "reserved" ? "#d2921b" : c.dot,
                      color: tone === "session" ? c.fg : undefined,
                    }}
                  >
                    <span className="mx-auto mb-1 h-1.5 w-2/3 rounded-full bg-white/90 ring-1 ring-line" aria-hidden />
                    <span className="font-bold">{bed.label}</span>
                    {v ? (
                      <>
                        <span className="mt-1 line-clamp-2 font-semibold break-words">{v.customerName}</span>
                        {v.groupId && <GroupLine v={v} />}
                        <span className="mt-auto line-clamp-1 opacity-90">{v.staffName}</span>
                        <span className="tnum font-semibold opacity-90">
                          {tone === "session" ? `${minutesSince(v.startedAt, now)} mnt` : "Menunggu"}
                        </span>
                      </>
                    ) : (
                      <span className="mt-auto text-muted">Kosong</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GroupLine({ v }: { v: VisitRow }) {
  return (
    <span className="mt-0.5 flex items-center gap-1 font-bold" style={{ color: groupColor(v.groupId!) }}>
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: groupColor(v.groupId!) }} />
      <span className="truncate">{v.relation ? groupText(v) : "Keluarga"}</span>
    </span>
  );
}
