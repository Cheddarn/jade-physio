"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button, Field, Input, Sheet, Switch, Textarea, cx, errorText, useToast } from "./ui";
import { CustomerPicker } from "./CustomerPicker";
import { useCollection, useServices, useStaff } from "@/lib/hooks";
import { createBooking, updateBooking, voucherCovers, voucherState } from "@/lib/actions";
import { atTime, dateKey, duration, hhmm, remaining, roundedNow, rupiah, staffColor } from "@/lib/format";
import type { Row } from "@/lib/store";
import type { Booking, Customer, Voucher } from "@/lib/types";

export interface BookingDraft {
  id?: string;
  customer?: Row<Customer> | null;
  staffId?: string;
  serviceId?: string;
  startAt?: number;
  durationMin?: number;
  notes?: string;
}

export function BookingSheet({
  open,
  onClose,
  draft,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  draft: BookingDraft | null;
  onSaved?: (id: string) => void;
}) {
  const { staff } = useStaff();
  const { services } = useServices();
  const toast = useToast();

  const [customer, setCustomer] = useState<Row<Customer> | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [day, setDay] = useState(dateKey());
  const [clock, setClock] = useState("09:00");
  const [dur, setDur] = useState(60);
  const [notes, setNotes] = useState("");
  const [startNow, setStartNow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const start = draft?.startAt ?? roundedNow(15);
    setCustomer(draft?.customer ?? null);
    setServiceId(draft?.serviceId ?? "");
    setStaffId(draft?.staffId ?? "");
    setDay(dateKey(start));
    setClock(hhmm(start));
    setDur(draft?.durationMin ?? 60);
    setNotes(draft?.notes ?? "");
    setStartNow(false);
    setError("");
  }, [open, draft]);

  const startAt = atTime(day, clock || "00:00");
  const endAt = startAt + dur * 60_000;

  // Load at the chosen time, so the desk can see how busy each therapist is.
  const { rows: dayBookings } = useCollection<Booking>(open ? "bookings" : null, [["dateKey", "==", day]]);
  const load = useMemo(() => {
    const m: Record<string, number> = {};
    for (const b of dayBookings ?? []) {
      if (b.status === "cancelled" || b.id === draft?.id) continue;
      const bEnd = b.startAt + b.durationMin * 60_000;
      if (b.startAt < endAt && bEnd > startAt) m[b.staffId] = (m[b.staffId] ?? 0) + 1;
    }
    return m;
  }, [dayBookings, startAt, endAt, draft?.id]);

  const { rows: custVouchers } = useCollection<Voucher>(customer ? "vouchers" : null, [
    ["customerId", "==", customer?.id ?? ""],
  ]);
  const activeVouchers = (custVouchers ?? []).filter((v) => voucherState(v) === "active");

  const isEdit = !!draft?.id;
  const service = services.find((s) => s.id === serviceId);
  const therapist = staff.find((s) => s.id === staffId);

  async function save() {
    setError("");
    if (!customer) return setError("Pilih pelanggan dulu.");
    if (!service) return setError("Pilih layanan.");
    if (!therapist) return setError("Pilih terapis.");
    if (dur < 5) return setError("Durasi minimal 5 menit.");
    setBusy(true);
    try {
      const input = { customer, staff: therapist, service, startAt, durationMin: dur, notes, status: startNow ? ("in_session" as const) : ("booked" as const) };
      if (isEdit) {
        await updateBooking(draft!.id!, input);
        toast("Booking diperbarui");
        onSaved?.(draft!.id!);
      } else {
        const id = await createBooking(input);
        toast(startNow ? `Sesi ${customer.name} dimulai` : `Booking ${customer.name} tersimpan`);
        onSaved?.(id);
      }
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? "Ubah booking" : "Booking baru"}
      footer={
        <div className="flex flex-col gap-3">
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button size="lg" block loading={busy} onClick={save}>
            {isEdit ? "Simpan perubahan" : startNow ? "Simpan & mulai sesi" : "Simpan booking"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <Field label="Pelanggan">
          <CustomerPicker
            value={customer}
            onChange={setCustomer}
            autoFocus={!isEdit && !draft?.customer}
            hint={() =>
              activeVouchers.length > 0 ? (
                <span className="text-[13px] font-medium text-jade-deep">
                  Punya voucher: {activeVouchers.map((v) => `${remaining(v)} sesi ${v.name}`).join(", ")}
                </span>
              ) : null
            }
          />
        </Field>

        <Field label="Layanan">
          <div className="grid gap-2">
            {services.map((s) => {
              const coveredByVoucher = activeVouchers.some((v) => voucherCovers(v, s.id));
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => {
                    setServiceId(s.id);
                    setDur(s.durationMin);
                  }}
                  className={cx(
                    "flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                    serviceId === s.id ? "border-jade bg-jade-mist/50 ring-1 ring-jade" : "border-line hover:border-ink-2/30",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{s.name}</span>
                    <span className="block text-[13px] text-muted">
                      {duration(s.durationMin)}
                      {coveredByVoucher && <span className="ml-2 font-medium text-jade-deep">Bisa pakai voucher</span>}
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-sm font-semibold">{rupiah(s.price)}</span>
                </button>
              );
            })}
            {services.length === 0 && <p className="text-sm text-muted">Belum ada layanan. Tambahkan di menu Katalog.</p>}
          </div>
        </Field>

        <Field label="Terapis" hint="Satu terapis bisa menangani beberapa pasien di jam yang sama.">
          <div className="flex flex-wrap gap-2">
            {staff.map((s) => {
              const c = staffColor(s.color);
              const n = load[s.id] ?? 0;
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setStaffId(s.id)}
                  className={cx(
                    "flex h-11 items-center gap-2 rounded-full border pr-3.5 pl-2.5 text-sm font-semibold transition-colors",
                    staffId === s.id ? "border-transparent ring-2" : "border-line hover:border-ink-2/30",
                  )}
                  style={staffId === s.id ? { background: c.bg, color: c.fg, ["--tw-ring-color" as string]: c.dot } : undefined}
                >
                  <span className="size-3 rounded-full" style={{ background: c.dot }} />
                  {s.name}
                  {n > 0 && (
                    <span className="tnum rounded-full bg-ink/8 px-1.5 text-xs font-bold" title={`${n} pasien di jam ini`}>
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal" htmlFor="bk-date">
            <Input id="bk-date" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
          <Field label="Jam mulai" htmlFor="bk-time">
            <div className="flex gap-1.5">
              <Input id="bk-time" type="time" step={300} value={clock} onChange={(e) => setClock(e.target.value)} />
            </div>
          </Field>
        </div>
        {!isEdit && (
          <div className="-mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                const n = roundedNow(5);
                setDay(dateKey(n));
                setClock(hhmm(n));
                setStartNow(true);
              }}
            >
              Sekarang (walk-in)
            </Button>
          </div>
        )}

        <Field label="Durasi" hint={`Selesai pukul ${hhmm(endAt).replace(":", ".")}`}>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" className="!w-11 !px-0" aria-label="Kurangi 15 menit" onClick={() => setDur((d) => Math.max(15, d - 15))}>
              <Minus className="size-4" />
            </Button>
            <div className="tnum flex h-11 min-w-28 items-center justify-center rounded-[10px] border border-line px-3 font-semibold md:h-10">
              {duration(dur)}
            </div>
            <Button type="button" variant="secondary" className="!w-11 !px-0" aria-label="Tambah 15 menit" onClick={() => setDur((d) => d + 15)}>
              <Plus className="size-4" />
            </Button>
          </div>
        </Field>

        <Field label="Catatan" htmlFor="bk-notes">
          <Textarea id="bk-notes" placeholder="Keluhan, area terapi, dll." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {!isEdit && (
          <div className="rounded-xl bg-canvas p-3.5">
            <Switch checked={startNow} onChange={setStartNow} label="Pasien sudah datang, langsung mulai sesi" />
          </div>
        )}
      </div>
    </Sheet>
  );
}
