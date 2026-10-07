"use client";

import { useMemo, useState } from "react";
import { BellRing, Check, ChevronLeft, ChevronRight, ClipboardCopy, MessageCircle } from "lucide-react";
import { Badge, Button, Empty, IconButton, Sheet, Spinner, cx, errorText, useToast } from "./ui";
import { waLink } from "./CustomerPicker";
import { useUser } from "@/lib/auth";
import { useCollection, useCustomers } from "@/lib/hooks";
import { addDays, dateKey, staffColor, time } from "@/lib/format";
import { dayWord, markReminded, reminderMessage } from "@/lib/reminders";
import { useStaff } from "@/lib/hooks";
import type { Row } from "@/lib/store";
import type { Booking } from "@/lib/types";

/** Bookings on a day that still need a reminder: booked and not started. */
export function useReminders(day: string, enabled = true) {
  const { rows, loading } = useCollection<Booking>(enabled ? "bookings" : null, [["dateKey", "==", day]]);
  const list = useMemo(
    () => (rows ?? []).filter((b) => b.dateKey === day && b.status === "booked").sort((a, b) => a.startAt - b.startAt),
    [rows, day],
  );
  return { list, loading, open: list.filter((b) => !b.remindedAt).length };
}

/**
 * WhatsApp reminders for the next day's appointments, sent one tap at a time.
 * Clinics that remind patients the day before see far fewer no-shows.
 */
export function ReminderSheet({ open, onClose, initialDay }: { open: boolean; onClose: () => void; initialDay?: string }) {
  const [day, setDay] = useState(initialDay ?? addDays(dateKey(), 1));
  const [lastInitial, setLastInitial] = useState(initialDay);
  if (initialDay !== lastInitial) {
    setLastInitial(initialDay);
    if (initialDay) setDay(initialDay);
  }
  const user = useUser();
  const toast = useToast();
  const { list, loading } = useReminders(day, open);
  const { customers } = useCustomers();
  const { staff } = useStaff(true);
  const phoneOf = (b: Booking) => b.customerPhone || customers.find((c) => c.id === b.customerId)?.phone || "";
  const done = list.filter((b) => b.remindedAt).length;

  async function send(b: Row<Booking>) {
    const url = waLink(phoneOf(b), reminderMessage(b));
    if (!url) return toast(`Nomor WhatsApp ${b.customerName} tidak ada`, "error");
    window.open(url, "_blank", "noopener");
    try {
      await markReminded(b.id, user.email);
    } catch (e) {
      toast(errorText(e), "error");
    }
  }

  async function copyAll() {
    const text = list.map((b) => `${time(b.startAt)} ${b.customerName} (${phoneOf(b) || "tanpa no. HP"}), ${b.serviceName}, ${b.staffName}`).join("\n");
    try {
      await navigator.clipboard.writeText(`Jadwal ${dayWord(day)}\n\n${text}`);
      toast(`${list.length} jadwal disalin`);
    } catch {
      window.prompt("Salin jadwal:", text);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Pengingat jadwal"
      footer={
        <Button variant="secondary" block icon={<ClipboardCopy className="size-4" />} disabled={!list.length} onClick={copyAll}>
          Salin daftar jadwal
        </Button>
      }
    >
      <div className="flex items-center gap-1">
        <IconButton label="Hari sebelumnya" onClick={() => setDay(addDays(day, -1))} disabled={day <= dateKey()}>
          <ChevronLeft className="size-5" />
        </IconButton>
        <p className="min-w-0 flex-1 text-center font-bold first-letter:uppercase">{dayWord(day)}</p>
        <IconButton label="Hari berikutnya" onClick={() => setDay(addDays(day, 1))}>
          <ChevronRight className="size-5" />
        </IconButton>
      </div>
      <p className="mt-2 text-center text-[13px] text-muted">
        Kirim pesan WhatsApp satu per satu. Pasien yang sudah diingatkan ditandai, jadi tidak terkirim dua kali.
      </p>
      {list.length > 0 && (
        <div className="mt-3 flex justify-center">
          <Badge tone={done === list.length ? "jade" : "amber"}>
            {done}/{list.length} sudah diingatkan
          </Badge>
        </div>
      )}

      <div className="mt-4">
        {loading ? (
          <Spinner />
        ) : list.length === 0 ? (
          <Empty icon={<BellRing className="size-5" />} title="Tidak ada booking" body="Belum ada pasien terjadwal di hari ini." />
        ) : (
          <ul className="divide-y divide-line-soft rounded-xl border border-line">
            {list.map((b) => {
              const c = staffColor(staff.find((s) => s.id === b.staffId)?.color);
              const phone = phoneOf(b);
              return (
                <li key={b.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="tnum w-11 shrink-0 text-sm font-bold">{time(b.startAt)}</span>
                  <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: c.dot }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{b.customerName}</p>
                    <p className="truncate text-[12px] text-muted">
                      {b.serviceName}, {b.staffName}
                      {!phone && <span className="font-semibold text-danger">, tanpa no. HP</span>}
                    </p>
                    {b.remindedAt && (
                      <p className="text-[12px] font-semibold text-jade-deep">
                        <Check className="mr-0.5 inline size-3" />
                        Diingatkan {time(b.remindedAt)}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={b.remindedAt ? "ghost" : "primary"}
                    icon={<MessageCircle className="size-3.5" />}
                    disabled={!phone}
                    className={cx(!b.remindedAt && "min-w-24")}
                    onClick={() => send(b)}
                  >
                    {b.remindedAt ? "Lagi" : "Ingatkan"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
