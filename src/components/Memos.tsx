"use client";

import { useState } from "react";
import { AlarmClock, BellRing, Check, Repeat, Trash2 } from "lucide-react";
import { Button, Confirm, Field, Input, Select, Sheet, Textarea, cx, errorText, useToast } from "./ui";
import { useFlowAlerts } from "./FlowAlerts";
import { useUser } from "@/lib/auth";
import { dateKey, shortDate, time } from "@/lib/format";
import { everyText, markMemoSeen, memoDue, memoWhen, removeMemo, saveMemo, useMemosOn } from "@/lib/memos";
import { dot, saveSettings, useSettings } from "@/lib/settings";
import type { Row } from "@/lib/store";
import type { Memo, Routine } from "@/lib/types";

export type MemoDraft = Row<Memo> | { dateKey: string };

const EVERY: number[] = [15, 30, 60, 90, 120, 180];

/** "10.32" today, "6 Okt 10.32" on another day. */
const seenText = (ms: number) => (dateKey(ms) === dateKey() ? time(ms) : `${shortDate(ms)} ${time(ms)}`);

/** Confirming a dated reminder clears it for everyone, with who saw it and when. */
function useSeeMemo() {
  const user = useUser();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  async function see(m: Row<Memo>) {
    setBusy(m.id);
    try {
      await markMemoSeen(m.id, user);
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(null);
    }
  }
  return { see, busy };
}

/** Bottom-right popups for reminders whose time has come, each with a confirm button. Lives in the app shell. */
export function ReminderPopups() {
  const { memos, routines, confirmRoutine, notifyAllowed, askNotify } = useFlowAlerts();
  const { see, busy } = useSeeMemo();
  const [hidden, setHidden] = useState(false);
  const count = memos.length + routines.length;
  // Something new coming up opens the panel again.
  const [shown, setShown] = useState(count);
  if (count !== shown) {
    setShown(count);
    if (count > shown) setHidden(false);
  }
  if (!count) return null;
  const today = dateKey();

  return (
    // Phones: above the floating button and the tab bar.
    <div className="no-print fixed right-3 bottom-[calc(152px+var(--safe-bottom))] z-40 flex w-[min(360px,calc(100vw-24px))] flex-col items-end md:right-6 md:bottom-6">
      {hidden ? (
        <button
          type="button"
          onClick={() => setHidden(false)}
          className="flex h-10 items-center gap-2 rounded-full bg-amber px-4 text-sm font-bold text-white shadow-[var(--shadow-lift)]"
        >
          <BellRing className="size-4" />
          {count} pengingat
        </button>
      ) : (
        <section aria-label="Pengingat" className="w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-lift)]">
          <div className="flex items-center justify-between gap-2 bg-amber-mist px-4 py-2.5">
            <p className="flex items-center gap-2 text-sm font-bold text-amber">
              <BellRing className="size-4" />
              Pengingat{count > 1 ? ` (${count})` : ""}
            </p>
            <button type="button" onClick={() => setHidden(true)} className="rounded-md px-2 py-1 text-[12px] font-semibold text-amber hover:bg-amber/10">
              Sembunyikan
            </button>
          </div>
          <ul className="scroll-thin max-h-[34vh] divide-y divide-line-soft overflow-y-auto md:max-h-[min(50vh,420px)]">
            {routines.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-muted">
                  <Repeat className="size-3" />
                  {time(r.at)}, {everyText(r.everyMin)}
                </p>
                <p className="mt-0.5 text-sm font-semibold break-words whitespace-pre-wrap">{r.text}</p>
                <Button size="sm" className="mt-2" icon={<Check className="size-3.5" />} onClick={() => confirmRoutine(r.id)}>
                  Sudah dilihat
                </Button>
              </li>
            ))}
            {memos.map((m) => (
              <li key={m.id} className="px-4 py-3">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-muted">
                  <AlarmClock className="size-3" />
                  {memoWhen(m, today)}, dari {m.createdByName}
                </p>
                <p className="mt-0.5 text-sm font-semibold break-words whitespace-pre-wrap">{m.text}</p>
                <Button size="sm" className="mt-2" icon={<Check className="size-3.5" />} loading={busy === m.id} onClick={() => see(m)}>
                  Sudah dilihat
                </Button>
              </li>
            ))}
          </ul>
          {notifyAllowed === false && (
            <button
              type="button"
              onClick={askNotify}
              className="w-full border-t border-line-soft px-4 py-2 text-left text-[12px] font-semibold text-jade hover:bg-jade-mist/50"
            >
              Izinkan notifikasi browser, supaya tetap muncul saat membuka tab lain
            </button>
          )}
        </section>
      )}
    </div>
  );
}

/** A dated reminder as a row: on the calendar day and on the Pengingat page. */
export function MemoRow({ m, now, onEdit, showDay }: { m: Row<Memo>; now: number; onEdit: (m: Row<Memo>) => void; showDay?: boolean }) {
  const { see, busy } = useSeeMemo();
  const due = !m.seenAt && memoDue(m, now);
  return (
    <div
      className={cx(
        "flex items-start gap-2.5 rounded-xl border px-3 py-2 text-[13px]",
        m.seenAt ? "border-line-soft bg-canvas text-muted" : due ? "border-amber/40 bg-amber-mist" : "border-line bg-surface",
      )}
    >
      <AlarmClock className={cx("mt-0.5 size-4 shrink-0", due ? "text-amber" : "text-muted")} />
      <button type="button" onClick={() => onEdit(m)} className="min-w-0 flex-1 text-left" aria-label={`Ubah pengingat: ${m.text}`}>
        <span className={cx("font-semibold", due ? "text-amber" : "text-ink-2")}>
          {showDay ? memoWhen(m, dateKey(now)) : m.time ? dot(m.time) : "Sepanjang hari"}
        </span>
        <span className={cx("ml-1.5 break-words whitespace-pre-wrap", m.seenAt ? "line-through decoration-muted/50" : "text-ink")}>{m.text}</span>
        {m.seenAt && (
          <span className="ml-1.5 inline-flex items-center gap-0.5 text-jade-deep">
            <Check className="size-3" />
            dilihat {m.seenByName}, {seenText(m.seenAt)}
          </span>
        )}
      </button>
      {due && (
        <Button size="sm" variant="secondary" icon={<Check className="size-3.5" />} loading={busy === m.id} onClick={() => see(m)} className="shrink-0">
          Sudah dilihat
        </Button>
      )}
    </div>
  );
}

/** The day's reminders on the calendar, under the header. Nothing when there are none. */
export function MemoStrip({ day, now, onEdit }: { day: string; now: number; onEdit: (m: Row<Memo>) => void }) {
  const { memos } = useMemosOn(day);
  if (!memos.length) return null;
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      {memos.map((m) => (
        <MemoRow key={m.id} m={m} now={now} onEdit={onEdit} />
      ))}
    </div>
  );
}

/** Add or change a dated reminder. */
export function MemoSheet({ value, onClose }: { value: MemoDraft | null; onClose: () => void }) {
  const user = useUser();
  const toast = useToast();
  const editing = value && "id" in value ? value : null;
  const [day, setDay] = useState("");
  const [at, setAt] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [openedFor, setOpenedFor] = useState<unknown>(null);
  if (value !== openedFor) {
    setOpenedFor(value);
    if (value) {
      setDay(value.dateKey);
      setAt(editing?.time ?? "");
      setText(editing?.text ?? "");
    }
  }
  const moved = !!editing && (editing.dateKey !== day || (editing.time ?? "") !== at);

  async function save() {
    setBusy(true);
    try {
      await saveMemo(editing, { dateKey: day, time: at || null, text: text.trim() }, user);
      toast(editing ? "Pengingat disimpan" : "Pengingat ditambahkan");
      onClose();
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Sheet
        open={!!value}
        onClose={onClose}
        title={editing ? "Ubah pengingat" : "Pengingat baru"}
        footer={
          <div className="flex gap-2">
            {editing && (
              <Button variant="danger" size="lg" icon={<Trash2 className="size-4" />} onClick={() => setRemoving(true)}>
                Hapus
              </Button>
            )}
            <Button size="lg" block loading={busy} disabled={!text.trim() || !day} onClick={save}>
              Simpan
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <Field label="Pesan" htmlFor="memo-text">
            <Textarea
              id="memo-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="mis. Telepon supplier, konfirmasi kiriman handuk"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tanggal" htmlFor="memo-day">
              <Input id="memo-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </Field>
            <Field label="Jam (opsional)" htmlFor="memo-time">
              <Input id="memo-time" type="time" value={at} onChange={(e) => setAt(e.target.value)} />
            </Field>
          </div>
          <p className="-mt-2 text-[13px] text-muted">
            Muncul di pojok kanan bawah untuk admin {at ? `mulai jam ${dot(at)}` : "sejak pagi"} di hari itu, sampai ada yang menekan{" "}
            <span className="font-semibold">Sudah dilihat</span>.
          </p>
          {editing?.seenAt && (
            <p className="rounded-xl bg-canvas px-4 py-3 text-[13px] text-ink-2">
              <Check className="mr-1 inline size-3.5 text-jade" />
              Dilihat {editing.seenByName}, {seenText(editing.seenAt)}.{moved ? " Karena tanggal atau jam diubah, pengingat ini akan muncul lagi." : ""}
            </p>
          )}
        </div>
      </Sheet>
      <Confirm
        open={removing}
        title="Hapus pengingat?"
        body={editing?.text ?? ""}
        confirmLabel="Hapus"
        tone="danger"
        onClose={() => setRemoving(false)}
        onConfirm={async () => {
          try {
            await removeMemo(editing!.id);
            toast("Pengingat dihapus");
            setRemoving(false);
            onClose();
          } catch (e) {
            toast(errorText(e), "error");
          }
        }}
      />
    </>
  );
}

/** Add or change a routine reminder (saved in the clinic settings). */
export function RoutineSheet({ value, onClose }: { value: Routine | "new" | null; onClose: () => void }) {
  const toast = useToast();
  const { settings } = useSettings();
  const [text, setText] = useState("");
  const [every, setEvery] = useState(60);
  const [busy, setBusy] = useState(false);
  const [openedFor, setOpenedFor] = useState<unknown>(null);
  if (value !== openedFor) {
    setOpenedFor(value);
    if (value) {
      setText(value === "new" ? "" : value.text);
      setEvery(value === "new" ? 60 : value.everyMin);
    }
  }
  const editing = value && value !== "new" ? value : null;

  async function save(routines: Routine[], done: string) {
    setBusy(true);
    try {
      await saveSettings({ routines });
      toast(done);
      onClose();
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title={editing ? "Ubah pengingat rutin" : "Pengingat rutin baru"}
      footer={
        <div className="flex gap-2">
          {editing && (
            <Button
              variant="danger"
              size="lg"
              icon={<Trash2 className="size-4" />}
              disabled={busy}
              onClick={() => save(settings.routines.filter((r) => r.id !== editing.id), "Pengingat rutin dihapus")}
            >
              Hapus
            </Button>
          )}
          <Button
            size="lg"
            block
            loading={busy}
            disabled={!text.trim()}
            onClick={() =>
              save(
                editing
                  ? settings.routines.map((r) => (r.id === editing.id ? { ...r, text: text.trim(), everyMin: every } : r))
                  : [...settings.routines, { id: `r${Date.now().toString(36)}`, text: text.trim(), everyMin: every, on: true }],
                "Pengingat rutin disimpan",
              )
            }
          >
            Simpan
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Pesan" htmlFor="routine-text">
          <Textarea id="routine-text" value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="mis. Cek dan balas DM Instagram" />
        </Field>
        <Field label="Muncul" htmlFor="routine-every">
          <Select id="routine-every" value={every} onChange={(e) => setEvery(Number(e.target.value))}>
            {[...new Set([...EVERY, every])].sort((a, b) => a - b).map((m) => (
              <option key={m} value={m}>
                {everyText(m)}
              </option>
            ))}
          </Select>
        </Field>
        <p className="-mt-2 text-[13px] text-muted">
          Muncul untuk admin saat klinik buka, lalu {everyText(every)} sampai jam tutup. Setiap admin menekan Sudah dilihat di perangkatnya sendiri.
        </p>
      </div>
    </Sheet>
  );
}
