"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Check, Pencil, Plus, Trash2, UserRound, Users, XCircle } from "lucide-react";
import { Badge, Button, Card, Confirm, Empty, Field, IconButton, Input, Select, Sheet, Spinner, Textarea, cx, errorText, useToast } from "@/components/ui";
import { Choice } from "@/components/PatientForm";
import { useUser } from "@/lib/auth";
import { useCollection, useDoc, useServices, useStaff } from "@/lib/hooks";
import { BUSINESS, addDays, atTime, dateKey, duration, fromDateKey, longDate, rupiah, time } from "@/lib/format";
import { dot, fromMin, hoursOn, toMin, useSettings } from "@/lib/settings";
import { REQUEST_LABEL, cancelRequest, savePersons, submitRequests } from "@/lib/portal";
import { relationLabel, relationOptions } from "@/lib/relations";
import { GENDER_SHORT } from "@/lib/flow";
import type { Row } from "@/lib/store";
import type { BookingRequest, Gender, PortalAccount, PortalPerson, RelationKind } from "@/lib/types";

const personLabel = (p: PortalPerson) => (p.relation === "self" || p.id === "self" ? "Saya sendiri" : relationLabel(p.relation as RelationKind, p.gender) || "Keluarga");

export default function PortalPage() {
  const user = useUser();
  const { row: account, loading } = useDoc<PortalAccount>("accounts", user.email);
  const { rows: requests } = useCollection<BookingRequest>("requests", [["accountEmail", "==", user.email]]);
  const [booking, setBooking] = useState(false);
  const [editPerson, setEditPerson] = useState<PortalPerson | "new" | null>(null);
  const [cancelling, setCancelling] = useState<Row<BookingRequest> | null>(null);
  const toast = useToast();

  const persons = account?.persons?.length ? account.persons : [{ id: "self", name: user.name, phone: "", relation: "self" as const }];
  const startOfToday = atTime(dateKey(), "00:00");
  const sorted = useMemo(() => [...(requests ?? [])].sort((a, b) => a.startAt - b.startAt), [requests]);
  const upcoming = sorted.filter((r) => (r.confirmedStartAt ?? r.startAt) >= startOfToday && (r.status === "pending" || r.status === "confirmed"));
  const history = sorted.filter((r) => !upcoming.includes(r)).reverse();

  async function removePerson(id: string) {
    try {
      await savePersons(user.email, account, persons.filter((p) => p.id !== id), user.name);
    } catch (e) {
      toast(errorText(e), "error");
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-5 pb-28 md:px-8 md:pt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-jade">{BUSINESS.name}</p>
          <h1 className="text-2xl leading-tight font-bold tracking-[-0.01em] md:text-[26px]">Halo, {user.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted">Booking terapi untuk Anda dan keluarga. Kami konfirmasi secepatnya.</p>
        </div>
        <Button size="lg" className="w-full sm:w-auto" icon={<CalendarPlus className="size-5" />} onClick={() => setBooking(true)}>
          Booking baru
        </Button>
      </div>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-bold text-ink-2">Jadwal mendatang</h2>
        {upcoming.length === 0 ? (
          <Card>
            <Empty icon={<CalendarPlus className="size-5" />} title="Belum ada booking" body="Tekan Booking baru untuk memilih tanggal, jam, dan fisioterapis." />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((r) => (
              <RequestCard key={r.id} r={r} onCancel={r.status === "pending" ? () => setCancelling(r) : undefined} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink-2">
              <Users className="size-4 text-jade" />
              Orang di akun ini
            </h2>
            <Button size="sm" variant="secondary" icon={<Plus className="size-3.5" />} onClick={() => setEditPerson("new")}>
              Tambah
            </Button>
          </div>
          <p className="mt-1 text-[13px] text-muted">Satu akun bisa booking untuk beberapa orang. Isi nama dan no. HP masing-masing.</p>
        </div>
        <Card className="divide-y divide-line-soft">
          {persons.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-jade-mist text-jade">
                <UserRound className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.name}</span>
                <span className="block truncate text-[13px] text-muted">
                  {personLabel(p)}
                  {p.phone ? `, ${p.phone}` : ", no. HP belum diisi"}
                </span>
              </span>
              <IconButton label={`Ubah ${p.name}`} onClick={() => setEditPerson(p)}>
                <Pencil className="size-4" />
              </IconButton>
              {p.id !== "self" && (
                <IconButton label={`Hapus ${p.name}`} onClick={() => removePerson(p.id)} className="hover:bg-danger-mist hover:text-danger">
                  <Trash2 className="size-4" />
                </IconButton>
              )}
            </div>
          ))}
        </Card>
      </section>

      {history.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-bold text-ink-2">Riwayat</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {history.slice(0, 20).map((r) => (
              <RequestCard key={r.id} r={r} muted />
            ))}
          </div>
        </section>
      )}

      <BookingSheet open={booking} onClose={() => setBooking(false)} persons={persons} account={account ?? null} onAddPerson={() => setEditPerson("new")} />
      <PersonSheet value={editPerson} persons={persons} account={account ?? null} onClose={() => setEditPerson(null)} />
      <Confirm
        open={!!cancelling}
        title="Batalkan permintaan booking?"
        body={cancelling ? `${cancelling.personName}, ${longDate(cancelling.startAt)} pukul ${time(cancelling.startAt)}.` : ""}
        confirmLabel="Batalkan"
        tone="danger"
        onClose={() => setCancelling(null)}
        onConfirm={async () => {
          try {
            await cancelRequest(cancelling!.id);
            toast("Permintaan dibatalkan");
            setCancelling(null);
          } catch (e) {
            toast(errorText(e), "error");
          }
        }}
      />
    </div>
  );
}

function RequestCard({ r, onCancel, muted }: { r: Row<BookingRequest>; onCancel?: () => void; muted?: boolean }) {
  const at = r.confirmedStartAt ?? r.startAt;
  const d = new Date(at);
  const tone = r.status === "confirmed" ? "jade" : r.status === "pending" ? "amber" : r.status === "rejected" ? "danger" : "neutral";
  return (
    <Card className={cx("p-4", muted && "opacity-75")}>
      <div className="flex items-start gap-3.5">
        <span
          className={cx(
            "flex w-14 shrink-0 flex-col items-center rounded-xl py-1.5 leading-tight",
            r.status === "confirmed" ? "bg-jade text-white" : "bg-jade-mist text-jade-deep",
          )}
        >
          <span className="text-[11px] font-semibold uppercase">{d.toLocaleDateString("id-ID", { weekday: "short" })}</span>
          <span className="tnum text-xl font-bold">{d.getDate()}</span>
          <span className="text-[11px] font-semibold">{d.toLocaleDateString("id-ID", { month: "short" })}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{r.personName}</p>
          <p className="tnum text-sm font-semibold text-ink-2">Pukul {time(at)}</p>
          <p className="text-[13px] text-muted">
            {r.serviceName}, {r.confirmedStaffName ?? r.staffName ?? "fisioterapis siapa saja"}
          </p>
          <Badge tone={tone} className="mt-1.5">
            {r.status === "confirmed" && <Check className="size-3" />}
            {REQUEST_LABEL[r.status]}
          </Badge>
        </div>
      </div>
      {r.complaint && <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-[13px]">{r.complaint}</p>}
      {r.status === "rejected" && r.reason && <p className="mt-2 text-[13px] text-danger">Catatan klinik: {r.reason}</p>}
      {onCancel && (
        <Button size="sm" variant="ghost" className="mt-2 -ml-2 text-danger hover:bg-danger-mist hover:text-danger" icon={<XCircle className="size-3.5" />} onClick={onCancel}>
          Batalkan
        </Button>
      )}
    </Card>
  );
}

/* ---------------- Book for one or more people ---------------- */

interface PersonPick {
  complaint: string;
  staffId: string;
}

function BookingSheet({
  open,
  onClose,
  persons,
  account,
  onAddPerson,
}: {
  open: boolean;
  onClose: () => void;
  persons: PortalPerson[];
  account: PortalAccount | null;
  onAddPerson: () => void;
}) {
  const user = useUser();
  const toast = useToast();
  const { services } = useServices();
  const { staff } = useStaff();
  const { settings } = useSettings();
  const [day, setDay] = useState(dateKey());
  const [clock, setClock] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [picked, setPicked] = useState<Record<string, PersonPick>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDay(dateKey());
      setClock("");
      setServiceId("");
      setPicked(persons.length === 1 ? { [persons[0].id]: { complaint: "", staffId: "" } } : {});
      setError("");
    }
  }

  const hours = hoursOn(settings, day);
  const service = services.find((s) => s.id === serviceId);
  // Half-hour slots inside opening hours, leaving room for the session; none in the past.
  const slots = useMemo(() => {
    if (!hours) return [];
    const out: string[] = [];
    const now = Date.now();
    for (let m = toMin(hours.start); m + (service?.durationMin ?? 30) <= toMin(hours.end); m += 30) {
      const hhmm = fromMin(m);
      if (atTime(day, hhmm) > now + 30 * 60_000) out.push(hhmm);
    }
    return out;
  }, [hours, day, service?.durationMin]);

  const chosen = persons.filter((p) => picked[p.id]);
  const nextDays = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(dateKey(), i)), []);

  async function submit() {
    setError("");
    if (!service) return setError("Pilih layanan.");
    if (!clock) return setError("Pilih jam.");
    if (chosen.length === 0) return setError("Pilih siapa yang akan terapi.");
    const noPhone = chosen.find((p) => !p.phone.trim());
    if (noPhone) return setError(`Isi no. HP untuk ${noPhone.name} dulu (ketuk Ubah di daftar orang).`);
    setBusy(true);
    try {
      const holder = persons.find((p) => p.id === "self" || p.relation === "self");
      await submitRequests(
        { email: user.email, name: account?.name ?? user.name, holderPhone: holder?.phone },
        service,
        atTime(day, clock),
        chosen.map((p) => ({ person: p, complaint: picked[p.id].complaint, staff: staff.find((s) => s.id === picked[p.id].staffId) ?? null })),
      );
      toast(chosen.length > 1 ? `Permintaan booking ${chosen.length} orang terkirim` : "Permintaan booking terkirim");
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
      wide
      title="Booking baru"
      footer={
        <div className="flex flex-col gap-3">
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button size="lg" block loading={busy} onClick={submit}>
            {chosen.length > 1 ? `Kirim permintaan untuk ${chosen.length} orang` : "Kirim permintaan booking"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <Field label="Layanan">
          <div className="grid gap-2 sm:grid-cols-2">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setServiceId(s.id)}
                className={cx(
                  "flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                  serviceId === s.id ? "border-jade bg-jade-mist/50 ring-1 ring-jade" : "border-line hover:border-ink-2/30",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{s.name}</span>
                  <span className="block text-[13px] text-muted">{duration(s.durationMin)}</span>
                </span>
                <span className="tnum shrink-0 text-sm font-semibold">{rupiah(s.price)}</span>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Tanggal" hint={hours ? `Buka ${dot(hours.start)}–${dot(hours.end)}` : "Klinik tutup di hari ini"}>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:-mx-6 md:px-6">
            {nextDays.map((k) => {
              const d = fromDateKey(k);
              const closed = !hoursOn(settings, k);
              return (
                <button
                  key={k}
                  type="button"
                  disabled={closed}
                  onClick={() => (setDay(k), setClock(""))}
                  aria-pressed={day === k}
                  className={cx(
                    "flex w-14 shrink-0 flex-col items-center rounded-xl border py-2 leading-tight transition-colors disabled:opacity-40",
                    day === k ? "border-jade bg-jade text-white" : "border-line bg-surface",
                  )}
                >
                  <span className="text-[11px] font-semibold">{k === dateKey() ? "Hari ini" : d.toLocaleDateString("id-ID", { weekday: "short" })}</span>
                  <span className="tnum text-lg font-bold">{d.getDate()}</span>
                  <span className="text-[11px]">{closed ? "Tutup" : d.toLocaleDateString("id-ID", { month: "short" })}</span>
                </button>
              );
            })}
            <label className="relative flex w-20 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line text-center text-[11px] leading-tight font-semibold text-jade">
              <CalendarPlus className="mb-1 size-4" />
              Tanggal lain
              <input
                type="date"
                min={dateKey()}
                value={day}
                onChange={(e) => e.target.value && (setDay(e.target.value), setClock(""))}
                className="absolute inset-0 opacity-0"
                aria-label="Pilih tanggal lain"
              />
            </label>
          </div>
          {!nextDays.includes(day) && <p className="text-sm font-semibold text-jade-deep">{longDate(day)}</p>}
        </Field>
        <Field label="Jam">
          {slots.length ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {slots.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setClock(t)}
                  aria-pressed={clock === t}
                  className={cx(
                    "tnum h-11 rounded-xl border text-sm font-semibold transition-colors",
                    clock === t ? "border-jade bg-jade text-white" : "border-line bg-surface hover:border-jade/50",
                  )}
                >
                  {dot(t)}
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-canvas px-4 py-3 text-sm text-muted">
              {hours ? "Tidak ada jam tersisa di hari ini. Pilih hari lain." : "Klinik tutup di hari ini. Pilih hari lain."}
            </p>
          )}
        </Field>

        <Field label="Siapa yang terapi?" hint="Bisa lebih dari satu orang di jam yang sama. Masing-masing dengan keluhan dan fisioterapisnya.">
          <div className="flex flex-col gap-2">
            {persons.map((p) => {
              const on = !!picked[p.id];
              return (
                <div key={p.id} className={cx("rounded-xl border transition-colors", on ? "border-jade bg-jade-mist/30" : "border-line")}>
                  <button
                    type="button"
                    onClick={() =>
                      setPicked((x) => {
                        const next = { ...x };
                        if (on) delete next[p.id];
                        else next[p.id] = { complaint: "", staffId: "" };
                        return next;
                      })
                    }
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
                    aria-pressed={on}
                  >
                    <span className={cx("flex size-5 shrink-0 items-center justify-center rounded-md border-2", on ? "border-jade bg-jade text-white" : "border-line")}>
                      {on && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{p.name}</span>
                      <span className="block text-[13px] text-muted">
                        {personLabel(p)}
                        {p.phone ? `, ${p.phone}` : ""}
                      </span>
                    </span>
                  </button>
                  {on && (
                    <div className="flex flex-col gap-3 border-t border-jade/20 px-3.5 py-3">
                      <Field label={`Keluhan ${p.name.split(" ")[0]}`} htmlFor={`cc-${p.id}`}>
                        <Textarea
                          id={`cc-${p.id}`}
                          className="min-h-16"
                          placeholder="mis. Nyeri punggung bawah sejak seminggu"
                          value={picked[p.id].complaint}
                          onChange={(e) => setPicked((x) => ({ ...x, [p.id]: { ...x[p.id], complaint: e.target.value } }))}
                        />
                      </Field>
                      <Field label="Fisioterapis" htmlFor={`st-${p.id}`}>
                        <Select
                          id={`st-${p.id}`}
                          value={picked[p.id].staffId}
                          onChange={(e) => setPicked((x) => ({ ...x, [p.id]: { ...x[p.id], staffId: e.target.value } }))}
                        >
                          <option value="">Siapa saja</option>
                          {staff.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                              {s.gender ? ` (${GENDER_SHORT[s.gender].toLowerCase()})` : ""}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                  )}
                </div>
              );
            })}
            <Button variant="quiet" className="self-start" icon={<Plus className="size-4" />} onClick={onAddPerson}>
              Tambah orang
            </Button>
          </div>
        </Field>
      </div>
    </Sheet>
  );
}

/* ---------------- People on the account ---------------- */

function PersonSheet({
  value,
  persons,
  account,
  onClose,
}: {
  value: PortalPerson | "new" | null;
  persons: PortalPerson[];
  account: PortalAccount | null;
  onClose: () => void;
}) {
  const user = useUser();
  const toast = useToast();
  const [p, setP] = useState<PortalPerson>({ id: "", name: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [openedFor, setOpenedFor] = useState<unknown>(null);
  if (value !== openedFor) {
    setOpenedFor(value);
    if (value === "new") setP({ id: `p${Date.now().toString(36)}`, name: "", phone: "", relation: "anak" });
    else if (value) setP({ ...value, relation: value.relation ?? (value.id === "self" ? "self" : undefined) });
  }
  const self = p.relation === "self" || p.id === "self";
  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title={value === "new" ? "Tambah orang" : `Ubah ${p.name}`}
      footer={
        <Button
          size="lg"
          block
          loading={busy}
          disabled={!p.name.trim() || !p.phone.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              const clean = { ...p, name: p.name.trim(), phone: p.phone.trim() };
              const next = persons.some((x) => x.id === p.id) ? persons.map((x) => (x.id === p.id ? clean : x)) : [...persons, clean];
              await savePersons(user.email, account, next, user.name);
              toast("Tersimpan");
              onClose();
            } catch (e) {
              toast(errorText(e), "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          Simpan
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nama lengkap" htmlFor="pp-name">
          <Input id="pp-name" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} autoFocus />
        </Field>
        <Field label="No. HP / WhatsApp" htmlFor="pp-phone" hint="Dipakai klinik untuk konfirmasi dan mengirim laporan terapi.">
          <Input id="pp-phone" type="tel" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} placeholder="0812 3456 7890" />
        </Field>
        <Field label="Jenis kelamin">
          <Choice
            value={p.gender}
            onChange={(g: Gender) => setP({ ...p, gender: g })}
            options={[
              ["L", "Laki-laki"],
              ["P", "Perempuan"],
            ]}
          />
        </Field>
        {!self && (
          <Field label="Hubungan dengan Anda" htmlFor="pp-rel">
            <Select id="pp-rel" value={p.relation ?? ""} onChange={(e) => setP({ ...p, relation: e.target.value as RelationKind })}>
              {relationOptions().map(([k, label]) => (
                <option key={k} value={k}>
                  {k === "pasangan" || k === "orang_tua" || k === "kakek_nenek" ? relationLabel(k, p.gender) : label}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
    </Sheet>
  );
}
