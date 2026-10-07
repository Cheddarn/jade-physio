"use client";

import { useState } from "react";
import { Clock, LogIn, LogOut, Timer } from "lucide-react";
import { Badge, Button, Confirm, Field, Input, cx, errorText, useToast } from "./ui";
import { useUser } from "@/lib/auth";
import { useDoc, useNow } from "@/lib/hooks";
import { isStaffRole } from "@/lib/roles";
import { time } from "@/lib/format";
import {
  OVERTIME_GRACE,
  clockIn,
  clockOut,
  dot,
  durationLong,
  durationText,
  hoursOn,
  overtimeAt,
  shiftOn,
  useMyAttendance,
  useSettings,
  workedMin,
} from "@/lib/settings";
import type { Attendance, TeamMember } from "@/lib/types";
import type { Row } from "@/lib/store";
import { dateKey } from "@/lib/format";

export function AttendanceStatus({ a, now }: { a: Attendance; now: number }) {
  if (a.outAt)
    return a.closing === "overtime" ? (
      <Badge tone="amber">Pulang, lembur {durationText(a.overtimeMin)}</Badge>
    ) : (
      <Badge tone="jade">Pulang normal</Badge>
    );
  const ot = overtimeAt(a, now);
  if (ot >= OVERTIME_GRACE)
    return (
      <Badge tone="amber">
        <span className="pulse-dot size-1.5 rounded-full bg-amber" />
        Lembur {durationText(ot)}
      </Badge>
    );
  return (
    <Badge tone="jade">
      <span className="pulse-dot size-1.5 rounded-full bg-jade" />
      Bekerja
    </Badge>
  );
}

/** "Masuk kerja" / "Pulang" for whoever is signed in. Overtime counts from the end of their shift. */
export function ClockCard({ compact, className }: { compact?: boolean; className?: string }) {
  const user = useUser();
  const toast = useToast();
  const now = useNow(30_000);
  const today = dateKey(now);
  const { settings } = useSettings();
  const { row: member } = useDoc<TeamMember>("team", isStaffRole(user.role) ? user.email : null);
  const { row: att, loading } = useMyAttendance(isStaffRole(user.role) ? user.email : "", today);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [note, setNote] = useState("");

  if (!isStaffRole(user.role) || loading) return null;
  const shift = shiftOn(member, today) ?? (member?.schedule && Object.keys(member.schedule).length ? null : hoursOn(settings, today));
  const shiftText = att?.shiftEnd ? `${dot(att.shiftStart)}–${dot(att.shiftEnd)}` : shift ? `${dot(shift.start)}–${dot(shift.end)}` : "Libur";
  const ot = att && !att.outAt ? overtimeAt(att, now) : 0;
  const overtime = ot >= OVERTIME_GRACE;

  async function doIn() {
    setBusy(true);
    try {
      await clockIn(user, member ?? undefined, settings);
      toast(`Absen masuk pukul ${time(Date.now())}`);
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cx(
        "rounded-xl border px-3 py-2.5",
        overtime ? "border-amber/40 bg-amber-mist" : "border-line bg-surface",
        className,
      )}
    >
      <div className={cx("flex items-center gap-2.5", compact && "flex-wrap")}>
        <span className={cx("flex size-8 shrink-0 items-center justify-center rounded-lg", overtime ? "bg-amber/15 text-amber" : "bg-jade-mist text-jade")}>
          {overtime ? <Timer className="size-4" /> : <Clock className="size-4" />}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className={cx("text-[13px] font-bold", overtime && "text-amber")}>
            {!att ? (
              "Belum absen masuk"
            ) : (
              <span className="tnum">
                Masuk {time(att.inAt)}
                {att.outAt ? ` – Pulang ${time(att.outAt)}` : ""}
              </span>
            )}
          </p>
          <p className="text-[12px] text-muted">
            {att ? (
              <>
                {att.outAt ? "Total " : "Sudah "}
                <span className="tnum font-semibold text-ink-2">{durationLong(workedMin(att, now))}</span>
                {overtime && <span className="font-semibold text-amber">, lembur {durationText(ot)}</span>}
                {att.outAt && att.closing === "overtime" && <span className="font-semibold text-amber">, lembur {durationText(att.overtimeMin)}</span>}
              </>
            ) : (
              <>Shift {shiftText}</>
            )}
          </p>
          {att && <p className="text-[12px] text-muted">Shift {shiftText}</p>}
        </div>
        {!att && (
          <Button size="sm" block={compact} loading={busy} icon={<LogIn className="size-3.5" />} onClick={doIn}>
            Masuk kerja
          </Button>
        )}
        {att && !att.outAt && (
          <Button size="sm" block={compact} variant={overtime ? "primary" : "secondary"} icon={<LogOut className="size-3.5" />} onClick={() => (setNote(""), setLeaving(true))}>
            Pulang
          </Button>
        )}
      </div>

      {att && (
        <Confirm
          open={leaving}
          title={overtime ? `Pulang dengan lembur ${durationText(ot)}?` : "Pulang sekarang?"}
          body={
            <span className="flex flex-col gap-2">
              <span className="tnum grid grid-cols-3 gap-2 rounded-xl bg-canvas p-3 text-center">
                <span>
                  <span className="block text-[11px] text-muted">Masuk</span>
                  <span className="text-lg font-bold">{time(att.inAt)}</span>
                </span>
                <span>
                  <span className="block text-[11px] text-muted">Pulang</span>
                  <span className="text-lg font-bold">{time(now)}</span>
                </span>
                <span>
                  <span className="block text-[11px] text-muted">Lama kerja</span>
                  <span className="text-[13px] leading-7 font-bold">{durationLong(workedMin(att, now))}</span>
                </span>
              </span>
              {overtime
                ? `Shift Anda selesai pukul ${dot(att.shiftEnd)}. ${durationLong(ot)} setelahnya dicatat sebagai lembur.`
                : att.shiftEnd
                  ? `Dicatat sebagai pulang normal (shift sampai ${dot(att.shiftEnd)}).`
                  : "Dicatat sebagai pulang normal."}
            </span>
          }
          confirmLabel={overtime ? "Pulang + catat lembur" : "Pulang normal"}
          onClose={() => setLeaving(false)}
          onConfirm={async () => {
            try {
              await clockOut(att as Row<Attendance>, note);
              toast(
                overtime
                  ? `Pulang pukul ${time(Date.now())}, lembur ${durationLong(ot)} tercatat`
                  : `Pulang pukul ${time(Date.now())}, total kerja ${durationLong(workedMin(att))}`,
              );
              setLeaving(false);
            } catch (e) {
              toast(errorText(e), "error");
            }
          }}
        >
          {overtime && (
            <Field label="Keterangan lembur (opsional)" htmlFor="ot-note">
              <Input id="ot-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. Pasien terakhir datang terlambat" />
            </Field>
          )}
        </Confirm>
      )}
    </div>
  );
}
