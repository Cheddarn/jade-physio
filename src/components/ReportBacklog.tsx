"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { Badge, Button, Card, cx } from "./ui";
import { ReportSheet } from "./ReportSheet";
import { useFlowAlerts } from "./FlowAlerts";
import { useCan, useUser } from "@/lib/auth";
import { useNow } from "@/lib/hooks";
import { dateKey, dayMonth, time } from "@/lib/format";
import { daysLate, lateText } from "@/lib/reports";
import type { Row } from "@/lib/store";
import type { Booking } from "@/lib/types";

/**
 * Finished sessions that still have no therapy report, from any day, oldest first.
 * A physio sees their own and writes each one from here; the desk and the manager see who owes what.
 */
export function ReportBacklog({ limit, older, className }: { limit?: number; /** Only sessions from before today. */ older?: boolean; className?: string }) {
  const { owed: all, visits } = useFlowAlerts();
  const user = useUser();
  const can = useCan();
  const today = dateKey(useNow(60_000));
  const [editing, setEditing] = useState<Row<Booking> | null>(null);
  const owed = older ? all.filter((b) => b.dateKey < today) : all;
  const therapist = user.role === "therapist";
  const canWrite = (b: Booking) => (therapist ? b.staffId === user.staffId : can("reports.write"));
  const visitOf = (id: string) => (visits ?? []).find((v) => v.bookingId === id);

  const sheet = (
    <ReportSheet
      booking={editing}
      visitId={editing ? visitOf(editing.id)?.id : null}
      complaint={editing ? visitOf(editing.id)?.complaint : undefined}
      onClose={() => setEditing(null)}
    />
  );
  if (!owed.length) return sheet;

  const overdue = owed.filter((b) => b.dateKey < today).length;
  const shown = limit ? owed.slice(0, limit) : owed;
  // For the desk: who to chase, most reports owed first.
  const perStaff = [...owed.reduce((m, b) => m.set(b.staffName, (m.get(b.staffName) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);

  return (
    <section className={className} aria-label="Laporan terapi yang belum dibuat">
      <Card className={cx("overflow-hidden", overdue ? "border-danger/40" : "border-amber/40")}>
        <div className={cx("px-4 py-3", overdue ? "bg-danger-mist/60" : "bg-amber-mist/60")}>
          <div className="flex items-center gap-2">
            <FileText className={cx("size-4 shrink-0", overdue ? "text-danger" : "text-amber")} />
            <h2 className="min-w-0 flex-1 truncate font-bold">Laporan terapi belum dibuat</h2>
            <Badge tone={overdue ? "danger" : "amber"}>{owed.length}</Badge>
          </div>
          <p className="mt-0.5 text-[13px] text-ink-2">
            {overdue ? `${overdue} sudah lewat hari. ` : ""}
            Laporan dibuat di hari yang sama dengan sesinya.
          </p>
        </div>
        {!therapist && perStaff.length > 1 && (
          <p className="border-t border-line-soft px-4 py-2 text-[13px] text-muted">
            {perStaff.map(([name, n]) => `${name} ${n}`).join(", ")}
          </p>
        )}
        <ul className="divide-y divide-line-soft border-t border-line-soft">
          {shown.map((b) => {
            const late = daysLate(b, today);
            return (
              <li key={b.id} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className={cx(
                    "w-[84px] shrink-0 rounded-md px-2 py-1 text-center text-[12px] font-bold",
                    late > 0 ? "bg-danger-mist text-danger" : "bg-amber-mist text-amber",
                  )}
                >
                  {lateText(b, today)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{b.customerName}</p>
                  <p className="truncate text-[13px] text-muted">
                    {late > 1 ? `${dayMonth(b.startAt)}, ` : ""}
                    {time(b.startAt)}, {b.serviceName}
                    {!therapist ? `, ${b.staffName}` : ""}
                  </p>
                </div>
                {canWrite(b) && (
                  <Button size="sm" icon={<FileText className="size-3.5" />} onClick={() => setEditing(b)}>
                    <span className="hidden sm:inline">Buat laporan</span>
                    <span className="sm:hidden">Buat</span>
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {limit != null && owed.length > limit && (
          <Link href="/laporan-terapi" className="block border-t border-line-soft px-4 py-2.5 text-center text-sm font-semibold text-jade hover:bg-canvas">
            Lihat semua {owed.length} laporan
          </Link>
        )}
      </Card>
      {sheet}
    </section>
  );
}
