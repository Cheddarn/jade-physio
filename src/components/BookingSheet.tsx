"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { Button, Field, Input, Sheet, Switch, Textarea, cx, errorText, useToast } from "./ui";
import { CustomerPicker } from "./CustomerPicker";
import { useCollection, usePackages, useServices, useStaff } from "@/lib/hooks";
import { createBooking, updateBooking, voucherCovers, voucherState } from "@/lib/actions";
import { atTime, dateKey, duration, hhmm, remaining, roundedNow, rupiah, shortDate, staffColor, validityText } from "@/lib/format";
import type { Row } from "@/lib/store";
import type { Booking, Customer, Voucher } from "@/lib/types";

const STEPS = ["Pasien", "Paket", "Jadwal", "Konfirmasi"] as const;

/** What pays for the session: the patient's package, a package sold with it, or a single service. */
type Pick = { kind: "voucher" | "package"; id: string } | null;

export interface BookingDraft {
  id?: string;
  customer?: Row<Customer> | null;
  staffId?: string;
  serviceId?: string;
  packageId?: string;
  voucherId?: string;
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
  const { packages } = usePackages();
  const toast = useToast();

  const [customer, setCustomer] = useState<Row<Customer> | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [pick, setPick] = useState<Pick>(null);
  const [staffId, setStaffId] = useState("");
  const [day, setDay] = useState(dateKey());
  const [clock, setClock] = useState("09:00");
  const [dur, setDur] = useState(60);
  const [notes, setNotes] = useState("");
  const [startNow, setStartNow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!open) return;
    // Editing opens on the summary; a booking for a known patient skips the patient step.
    setStep(draft?.id ? 3 : draft?.customer ? 1 : 0);
    const start = draft?.startAt ?? roundedNow(15);
    setCustomer(draft?.customer ?? null);
    setServiceId(draft?.serviceId ?? "");
    setPick(draft?.voucherId ? { kind: "voucher", id: draft.voucherId } : draft?.packageId ? { kind: "package", id: draft.packageId } : null);
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
  const pickedVoucher = pick?.kind === "voucher" ? activeVouchers.find((v) => v.id === pick.id) ?? null : null;
  const pickedPackage = pick?.kind === "package" ? packages.find((p) => p.id === pick.id) ?? null : null;
  // Services the picked package can be used for (all of them when it lists none).
  const allowedIds = (pickedVoucher ?? pickedPackage)?.serviceIds ?? [];
  const eligible = pick ? services.filter((s) => allowedIds.length === 0 || allowedIds.includes(s.id)) : [];
  const sellsPackages = packages.length > 0 || activeVouchers.length > 0;

  function choose(next: Pick, ids: string[]) {
    setPick(next);
    setError("");
    const options = services.filter((s) => ids.length === 0 || ids.includes(s.id));
    const keep = options.find((s) => s.id === serviceId);
    const only = options.length === 1 ? options[0] : null;
    const svc = keep ?? only;
    setServiceId(svc?.id ?? "");
    if (svc) setDur(svc.durationMin);
    // One possible service: nothing more to ask on this step.
    if (only && !isEdit) setStep(2);
  }
  const therapist = staff.find((s) => s.id === staffId);

  /** What is still missing on a step, or "" when it is complete. */
  const missing = (i: number) =>
    i === 0 ? (!customer ? "Pilih pelanggan dulu." : "")
    : i === 1 ? (sellsPackages && !pick ? "Pilih paket." : !service ? (pick ? "Pilih layanan untuk sesi ini." : "Pilih layanan.") : "")
    : i === 2 ? (!clock || !day ? "Isi tanggal dan jam." : dur < 5 ? "Durasi minimal 5 menit." : !therapist ? "Pilih terapis." : "")
    : "";
  const firstMissing = [0, 1, 2].find((i) => missing(i));
  // A step can be opened once every step before it is complete.
  const reachable = (i: number) => isEdit || [0, 1, 2].filter((k) => k < i).every((k) => !missing(k));

  function next() {
    const m = missing(step);
    if (m) return setError(m);
    setError("");
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  async function save() {
    setError("");
    if (firstMissing !== undefined) {
      setStep(firstMissing);
      return setError(missing(firstMissing));
    }
    if (!customer || !service || !therapist) return;
    setBusy(true);
    try {
      const input = { customer, staff: therapist, service, pkg: pickedPackage, voucher: pickedVoucher, startAt, durationMin: dur, notes, status: startNow ? ("in_session" as const) : ("booked" as const) };
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
      center
      title={isEdit ? "Ubah booking" : "Booking baru"}
      subheader={<Stepper step={step} done={(i) => i < 3 && !missing(i)} reachable={reachable} onPick={(i) => (setError(""), setStep(i))} />}
      footer={
        <div className="flex flex-col gap-3">
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button size="lg" variant="secondary" icon={<ChevronLeft className="size-4" />} onClick={() => (setError(""), setStep(step - 1))}>
                Kembali
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <>
                {isEdit && (
                  <Button size="lg" variant="secondary" loading={busy} onClick={save} className="ml-auto">
                    Simpan
                  </Button>
                )}
                <Button size="lg" onClick={next} className={cx("flex-1", !isEdit && "ml-auto")}>
                  Lanjut
                  <ChevronRight className="size-4" />
                </Button>
              </>
            ) : (
              <Button size="lg" loading={busy} onClick={save} className="flex-1">
                {isEdit ? "Simpan perubahan" : startNow ? "Simpan & mulai sesi" : "Simpan booking"}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {step === 0 && (
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
        )}

        {step === 1 && (
          <div className="flex flex-col gap-5">
            {activeVouchers.length > 0 && (
              <Field label="Paket yang sudah dibeli">
                <div className="grid gap-2">
                  {activeVouchers.map((v) => (
                    <Option
                      key={v.id}
                      selected={pick?.kind === "voucher" && pick.id === v.id}
                      onClick={() => choose({ kind: "voucher", id: v.id }, v.serviceIds)}
                      title={v.name}
                      sub={`Sisa ${remaining(v)} dari ${v.totalSessions} sesi${v.expiresAt ? `, berlaku s/d ${shortDate(dateKey(v.expiresAt))}` : ""}`}
                      right={<span className="text-[13px] font-semibold text-jade-deep">Pakai</span>}
                    />
                  ))}
                </div>
              </Field>
            )}
            {packages.length > 0 ? (
              <Field label={activeVouchers.length ? "Atau beli paket baru" : "Paket"} hint="Paket dibayar saat checkout; sesi ini jadi sesi pertamanya.">
                <div className="grid gap-2">
                  {packages.map((p) => (
                    <Option
                      key={p.id}
                      selected={pick?.kind === "package" && pick.id === p.id}
                      onClick={() => choose({ kind: "package", id: p.id }, p.serviceIds)}
                      title={p.name}
                      sub={`${p.sessions} sesi${p.validityDays ? `, berlaku ${validityText(p.validityDays)}` : ""}${p.serviceIds.length ? `, ${services.filter((s) => p.serviceIds.includes(s.id)).map((s) => s.name).join(" / ")}` : ""}`}
                      right={<span className="tnum text-sm font-semibold">{rupiah(p.price)}</span>}
                    />
                  ))}
                </div>
              </Field>
            ) : (
              !activeVouchers.length && (
                <Field label="Layanan">
                  <div className="grid gap-2">
                    {services.map((s) => (
                      <Option
                        key={s.id}
                        selected={serviceId === s.id}
                        onClick={() => {
                          setServiceId(s.id);
                          setDur(s.durationMin);
                          setError("");
                          if (!isEdit) setStep(2);
                        }}
                        title={s.name}
                        sub={duration(s.durationMin)}
                        right={<span className="tnum text-sm font-semibold">{rupiah(s.price)}</span>}
                      />
                    ))}
                    {services.length === 0 && <p className="text-sm text-muted">Belum ada paket atau layanan. Tambahkan di menu Katalog.</p>}
                  </div>
                </Field>
              )
            )}
            {pick && eligible.length > 1 && (
              <Field label="Sesi ini untuk layanan">
                <div className="flex flex-wrap gap-2">
                  {eligible.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => {
                        setServiceId(s.id);
                        setDur(s.durationMin);
                        setError("");
                        if (!isEdit) setStep(2);
                      }}
                      className={cx(
                        "h-10 rounded-full border px-3.5 text-sm font-semibold transition-colors",
                        serviceId === s.id ? "border-jade bg-jade-mist text-jade-deep" : "border-line hover:border-ink-2/30",
                      )}
                    >
                      {s.name}
                      <span className="ml-1.5 font-normal text-muted">{duration(s.durationMin)}</span>
                    </button>
                  ))}
                </div>
              </Field>
            )}
          </div>
        )}

        {step === 2 && (
          <>

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
          </>
        )}

        {step === 3 && (
          <>
            <Summary
              rows={[
                ["Pasien", customer ? `${customer.name}${customer.phone ? `, ${customer.phone}` : ""}` : "–", 0],
                [
                  "Paket",
                  pickedVoucher
                    ? `${pickedVoucher.name} (sisa ${remaining(pickedVoucher)} sesi), ${service?.name ?? "–"}`
                    : pickedPackage
                      ? `Beli ${pickedPackage.name}, ${rupiah(pickedPackage.price)}; ${service?.name ?? "–"}`
                      : service
                        ? `${service.name}, ${rupiah(service.price)}`
                        : "–",
                  1,
                ],
                ["Waktu", `${new Date(startAt).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}, ${hhmm(startAt).replace(":", ".")}–${hhmm(endAt).replace(":", ".")}`, 2],
                ["Terapis", therapist?.name ?? "–", 2],
              ]}
              onEdit={(i) => setStep(i)}
            />
            {!pick && service && activeVouchers.some((v) => voucherCovers(v, service.id)) && (
              <p className="-mt-3 text-[13px] font-medium text-jade-deep">Layanan ini bisa dibayar dengan voucher pasien.</p>
            )}
            <Field label="Catatan" htmlFor="bk-notes">
              <Textarea id="bk-notes" placeholder="Keluhan, area terapi, dll." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>

            {!isEdit && (
              <div className="rounded-xl bg-canvas p-3.5">
                <Switch checked={startNow} onChange={setStartNow} label="Pasien sudah datang, langsung mulai sesi" />
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

/** Numbered steps at the top of the form; a step can be opened once the ones before it are filled. */
function Stepper({
  step,
  done,
  reachable,
  onPick,
}: {
  step: number;
  done: (i: number) => boolean;
  reachable: (i: number) => boolean;
  onPick: (i: number) => void;
}) {
  return (
    <ol className="flex items-center gap-1.5">
      {STEPS.map((label, i) => {
        const current = i === step;
        const ok = done(i) && !current;
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-1.5">
            <button
              type="button"
              disabled={!reachable(i)}
              onClick={() => onPick(i)}
              aria-current={current ? "step" : undefined}
              className="flex min-w-0 items-center gap-2 rounded-lg py-1 text-left disabled:cursor-not-allowed"
            >
              <span
                className={cx(
                  "tnum flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                  current ? "bg-jade text-white" : ok ? "bg-jade-mist text-jade-deep" : "bg-line-soft text-muted",
                )}
              >
                {ok ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cx("truncate text-[13px] font-semibold", current ? "text-ink" : "text-muted", !current && "hidden sm:inline")}>{label}</span>
            </button>
            {i < STEPS.length - 1 && <span className="h-px min-w-3 flex-1 bg-line" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

function Summary({ rows, onEdit }: { rows: [label: string, value: string, step: number][]; onEdit: (step: number) => void }) {
  return (
    <dl className="divide-y divide-line-soft rounded-xl border border-line">
      {rows.map(([label, value, s]) => (
        <div key={label} className="flex items-start gap-3 px-3.5 py-2.5">
          <dt className="w-20 shrink-0 text-[13px] text-muted">{label}</dt>
          <dd className="min-w-0 flex-1 text-sm font-semibold">{value}</dd>
          <dd>
            <button type="button" onClick={() => onEdit(s)} className="text-[13px] font-semibold text-jade hover:underline" aria-label={`Ubah ${label.toLowerCase()}`}>
              Ubah
            </button>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Option({ selected, onClick, title, sub, right }: { selected: boolean; onClick: () => void; title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        "flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
        selected ? "border-jade bg-jade-mist/50 ring-1 ring-jade" : "border-line hover:border-ink-2/30",
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{title}</span>
        {sub && <span className="block text-[13px] text-muted">{sub}</span>}
      </span>
      {right && <span className="shrink-0">{right}</span>}
    </button>
  );
}
