"use client";

import { useState } from "react";
import { Check, Clock, FileText, Pencil, RotateCcw } from "lucide-react";
import { Badge, Button, Field, Input, MoneyInput, Segmented, Select, Sheet, Switch, cx, errorText, useToast } from "./ui";
import { useUser } from "@/lib/auth";
import { clearPayDay, rateAmount, rateFor, rateText, saveCommission, setPayDay, type DayPay, type StaffPay } from "@/lib/commission";
import { dateKey, longDate, rupiah, shortDate, staffColor, time } from "@/lib/format";
import type { Row } from "@/lib/store";
import type { CommissionRate, CommissionSettings, Service, Staff } from "@/lib/types";

/* ---------------- The rules in one glance ---------------- */

export function RulesSummary({ settings, className }: { settings: CommissionSettings; className?: string }) {
  const c = settings.compensation;
  const items: { on: boolean; text: string }[] = [
    {
      on: settings.enabled,
      text: settings.enabled
        ? `Komisi aktif${settings.since ? ` sejak ${shortDate(settings.since)}` : ""}, bawaan ${rateText(settings.defaultRate).toLowerCase()}${settings.defaultRate.type === "percent" ? " dari harga layanan" : settings.defaultRate.type === "flat" ? " per sesi" : ""}`
        : "Komisi tidak aktif",
    },
    {
      on: c.enabled,
      text: c.enabled
        ? `Kompensasi ${rupiah(c.amount)} per hari kerja tanpa pasien (${c.basis === "attendance" ? "dihitung dari absen masuk" : "dihitung dari jadwal shift"})`
        : "Kompensasi harian tidak aktif",
    },
    ...(settings.enabled && settings.holdUntilReport ? [{ on: true, text: "Komisi sesi cair setelah laporan terapinya dibuat" }] : []),
  ];
  return (
    <ul className={cx("flex flex-col gap-1.5 text-[13px]", className)}>
      {items.map((x) => (
        <li key={x.text} className={cx("flex items-start gap-2", x.on ? "text-ink-2" : "text-muted")}>
          <span className={cx("mt-1.5 size-1.5 shrink-0 rounded-full", x.on ? "bg-jade" : "bg-line")} />
          {x.text}
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Settings (manager) ---------------- */

type RateKind = CommissionRate["type"] | "inherit";

function RateEditor({
  id,
  rate,
  onChange,
  inherit,
  price,
}: {
  id: string;
  /** undefined = follows the default (only where `inherit` is given). */
  rate: CommissionRate | undefined;
  onChange: (r: CommissionRate | undefined) => void;
  /** The default it would follow, for services. */
  inherit?: CommissionRate;
  /** Shows what the rate comes to for a service at this price. */
  price?: number;
}) {
  const kind: RateKind = rate ? rate.type : "inherit";
  const effective = rate ?? inherit!;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        id={id}
        aria-label="Jenis komisi"
        className="!h-10 w-full sm:!w-52"
        value={kind}
        onChange={(e) => {
          const k = e.target.value as RateKind;
          if (k === "inherit") onChange(undefined);
          else onChange({ type: k, value: k === "none" ? 0 : rate && rate.type === k ? rate.value : 0 });
        }}
      >
        {inherit && <option value="inherit">Ikut bawaan ({rateText(inherit)})</option>}
        <option value="percent">Persen dari harga</option>
        <option value="flat">Nominal tetap</option>
        <option value="none">Tanpa komisi</option>
      </Select>
      {rate?.type === "percent" && (
        <div className="relative w-24">
          <Input
            aria-label="Persen komisi"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step={0.5}
            className="!h-10 pr-7"
            value={rate.value || ""}
            placeholder="0"
            onChange={(e) => onChange({ type: "percent", value: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">%</span>
        </div>
      )}
      {rate?.type === "flat" && <MoneyInput className="w-36 [&_input]:!h-10" value={rate.value} onChange={(value) => onChange({ type: "flat", value })} />}
      {price != null && effective.type !== "none" && (
        <span className="tnum text-[13px] text-muted">= {rupiah(rateAmount(effective, price))} per sesi</span>
      )}
    </div>
  );
}

export function CommissionSettingsSheet({
  open,
  onClose,
  settings,
  services,
  staff,
}: {
  open: boolean;
  onClose: () => void;
  settings: CommissionSettings;
  services: Row<Service>[];
  staff: Row<Staff>[];
}) {
  const toast = useToast();
  const [s, setS] = useState<CommissionSettings>(settings);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setS(settings);
  }
  const today = dateKey();
  const comp = s.compensation;
  const setComp = (patch: Partial<CommissionSettings["compensation"]>) => setS((x) => ({ ...x, compensation: { ...x.compensation, ...patch } }));

  async function save() {
    setBusy(true);
    try {
      // Only rates for services that still exist are kept.
      const ids = new Set(services.map((x) => x.id));
      await saveCommission({
        ...s,
        since: s.enabled ? (s.since ?? today) : s.since,
        rates: Object.fromEntries(Object.entries(s.rates).filter(([id]) => ids.has(id))),
        compensation: { ...comp, since: comp.enabled ? (comp.since ?? today) : comp.since },
      });
      toast("Aturan komisi disimpan");
      onClose();
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      title="Atur komisi"
      footer={
        <Button size="lg" block loading={busy} onClick={save}>
          Simpan aturan
        </Button>
      }
    >
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <div>
            <h3 className="font-bold">Komisi per sesi</h3>
            <p className="mt-0.5 text-[13px] text-muted">
              Dihitung untuk setiap sesi yang selesai, dari harga layanan. Tarifnya dikunci saat checkout, jadi mengubah tarif tidak mengubah komisi yang sudah lewat.
            </p>
          </div>
          <div className="rounded-xl bg-canvas p-3.5">
            {/* Switching it back on starts from today, so the days it was off are not paid unless the date is moved back. */}
            <Switch
              checked={s.enabled}
              onChange={(enabled) => setS((x) => ({ ...x, enabled, since: enabled ? (settings.enabled ? (x.since ?? today) : today) : x.since }))}
              label="Komisi aktif"
            />
          </div>
          {s.enabled && (
            <>
              <Field label="Berlaku sejak" htmlFor="cm-since" hint="Sesi sebelum tanggal ini tidak mendapat komisi. Mundurkan tanggalnya bila sesi yang sudah lewat juga dihitung.">
                <Input id="cm-since" type="date" className="sm:w-48" value={s.since ?? today} onChange={(e) => setS((x) => ({ ...x, since: e.target.value || today }))} />
              </Field>
              <Field label="Tarif bawaan" htmlFor="cm-default" hint="Untuk layanan yang tidak punya tarif sendiri.">
                <RateEditor id="cm-default" rate={s.defaultRate} onChange={(r) => setS((x) => ({ ...x, defaultRate: r ?? { type: "none", value: 0 } }))} />
              </Field>
              <div>
                <p className="text-[13px] font-semibold text-ink-2">Tarif per layanan</p>
                <ul className="mt-1.5 divide-y divide-line-soft rounded-xl border border-line">
                  {services.map((sv) => (
                    <li key={sv.id} className="px-3.5 py-3">
                      <p className="flex items-baseline justify-between gap-3 text-sm">
                        <span className={cx("truncate font-semibold", !sv.active && "text-muted")}>{sv.name}</span>
                        <span className="tnum shrink-0 text-[13px] text-muted">{rupiah(sv.price)}</span>
                      </p>
                      <div className="mt-2">
                        <RateEditor
                          id={`cm-${sv.id}`}
                          rate={s.rates[sv.id]}
                          inherit={s.defaultRate}
                          price={sv.price}
                          onChange={(r) =>
                            setS((x) => {
                              const rates = { ...x.rates };
                              if (r) rates[sv.id] = r;
                              else delete rates[sv.id];
                              return { ...x, rates };
                            })
                          }
                        />
                      </div>
                    </li>
                  ))}
                  {services.length === 0 && <li className="px-3.5 py-4 text-sm text-muted">Belum ada layanan di Katalog.</li>}
                </ul>
              </div>
              <div className="rounded-xl bg-canvas p-3.5">
                <Switch checked={s.holdUntilReport} onChange={(holdUntilReport) => setS((x) => ({ ...x, holdUntilReport }))} label="Tahan komisi sampai laporan terapi dibuat" />
                <p className="mt-1.5 pl-[52px] text-[13px] text-muted">Komisi sebuah sesi baru dihitung setelah fisioterapisnya mengisi laporan terapi sesi itu.</p>
              </div>
            </>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <h3 className="font-bold">Kompensasi harian</h3>
            <p className="mt-0.5 text-[13px] text-muted">
              Jumlah tetap untuk hari kerja tanpa satu pun pasien, jadi tanpa komisi. Hari ini baru dihitung setelah harinya lewat. Jumlah untuk tanggal tertentu bisa diubah di rincian tiap fisioterapis.
            </p>
          </div>
          <div className="rounded-xl bg-canvas p-3.5">
            <Switch
              checked={comp.enabled}
              onChange={(enabled) => setComp({ enabled, since: enabled ? (settings.compensation.enabled ? (comp.since ?? today) : today) : comp.since })}
              label="Kompensasi harian aktif"
            />
          </div>
          {comp.enabled && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Jumlah per hari" htmlFor="cm-comp">
                  <MoneyInput id="cm-comp" value={comp.amount} onChange={(amount) => setComp({ amount })} />
                </Field>
                <Field label="Berlaku sejak" htmlFor="cm-comp-since">
                  <Input id="cm-comp-since" type="date" value={comp.since ?? today} onChange={(e) => setComp({ since: e.target.value || today })} />
                </Field>
              </div>
              <Field
                label="Yang dihitung sebagai hari kerja"
                hint={
                  comp.basis === "attendance"
                    ? "Fisioterapis menekan Masuk kerja hari itu. Tanpa absen, tidak ada kompensasi."
                    : "Ada shift untuk hari itu di Jadwal kerja, meski tidak absen."
                }
              >
                <Segmented
                  className="w-full sm:w-auto"
                  value={comp.basis}
                  onChange={(basis) => setComp({ basis })}
                  options={[
                    { value: "attendance", label: "Absen masuk" },
                    { value: "shift", label: "Jadwal shift" },
                  ]}
                />
              </Field>
            </>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <h3 className="font-bold">Fisioterapis yang ikut</h3>
            <p className="mt-0.5 text-[13px] text-muted">Ketuk untuk mengeluarkan seseorang dari komisi dan kompensasi.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {staff.map((st) => {
              const on = !s.staffOff.includes(st.id);
              const c = staffColor(st.color);
              return (
                <button
                  key={st.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setS((x) => ({ ...x, staffOff: on ? [...x.staffOff, st.id] : x.staffOff.filter((id) => id !== st.id) }))}
                  className={cx(
                    "flex h-10 items-center gap-2 rounded-full border pr-3.5 pl-2.5 text-sm font-semibold transition-colors",
                    on ? "border-jade bg-jade-mist text-jade-deep" : "border-line text-muted line-through decoration-1",
                  )}
                >
                  <span className="size-3 rounded-full" style={{ background: c.dot }} />
                  {st.name}
                  {on && <Check className="size-3.5" />}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </Sheet>
  );
}

/* ---------------- One physio, day by day ---------------- */

export function PayDays({
  pay,
  settings,
  manage,
  today,
}: {
  pay: StaffPay;
  settings: CommissionSettings;
  manage: boolean;
  today: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const days = [...pay.days].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  if (!days.length) return <p className="rounded-xl bg-canvas px-4 py-6 text-center text-sm text-muted">Belum ada sesi atau hari kerja di rentang ini.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {days.map((d) => (
        <li key={d.dateKey} className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="flex items-baseline justify-between gap-3 border-b border-line-soft bg-canvas/60 px-3.5 py-2">
            <p className="text-[13px] font-bold">{d.dateKey === today ? `Hari ini, ${shortDate(d.dateKey)}` : longDate(d.dateKey)}</p>
            <p className="tnum text-sm font-bold">{rupiah(d.commission + d.compensation)}</p>
          </div>
          {d.sessions.map((x) => (
            <div key={x.b.id} className="flex items-start gap-3 px-3.5 py-2.5 text-sm">
              <span className="tnum w-11 shrink-0 pt-px text-[13px] font-semibold text-muted">{time(x.b.startAt)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{x.b.customerName}</p>
                <p className="truncate text-[13px] text-muted">
                  {x.b.serviceName}, {x.rate.type === "none" ? "tanpa komisi" : rateText(x.rate)}
                </p>
                {(x.held || x.estimated) && (
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {x.held && (
                      <Badge tone="amber">
                        <FileText className="size-3" />
                        Ditahan, laporan belum dibuat
                      </Badge>
                    )}
                    {x.estimated && x.amount > 0 && <Badge>Perkiraan, belum checkout</Badge>}
                  </p>
                )}
              </div>
              <span className={cx("tnum shrink-0 font-semibold", x.held && "text-muted line-through decoration-1")}>{rupiah(x.amount)}</span>
            </div>
          ))}
          <CompRow d={d} pay={pay} settings={settings} manage={manage} today={today} editing={editing === d.dateKey} onEdit={(on) => setEditing(on ? d.dateKey : null)} />
        </li>
      ))}
    </ol>
  );
}

/** The compensation line of a day, which the manager can set by hand. */
function CompRow({
  d,
  pay,
  settings,
  manage,
  today,
  editing,
  onEdit,
}: {
  d: DayPay;
  pay: StaffPay;
  settings: CommissionSettings;
  manage: boolean;
  today: string;
  editing: boolean;
  onEdit: (on: boolean) => void;
}) {
  const user = useUser();
  const toast = useToast();
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const comp = settings.compensation;
  const idle = d.sessions.length === 0;
  // Nothing to say on a day with patients and no hand-set amount.
  if (!idle && !d.compKind && !manage) return null;

  const why =
    d.compKind === "manual"
      ? `Diatur manual${d.note ? `: ${d.note}` : ""}`
      : d.compKind === "auto"
        ? "Hari kerja tanpa pasien"
        : !idle
          ? ""
          : d.dateKey >= today
            ? "Tanpa pasien sejauh ini. Kompensasi dihitung setelah hari berakhir."
            : !comp.enabled
              ? "Tanpa pasien. Kompensasi harian tidak aktif."
              : pay.excluded
                ? "Tanpa pasien. Tidak ikut kompensasi."
                : comp.since && d.dateKey < comp.since
                  ? "Tanpa pasien, sebelum kompensasi berlaku."
                  : "Tanpa pasien.";

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      onEdit(false);
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  if (editing)
    return (
      <div className="flex flex-col gap-3 border-t border-line-soft bg-canvas/60 px-3.5 py-3">
        <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
          <Field label="Kompensasi hari ini" htmlFor={`pd-${d.dateKey}`}>
            <MoneyInput id={`pd-${d.dateKey}`} value={amount} onChange={setAmount} />
          </Field>
          <Field label="Catatan (opsional)" htmlFor={`pn-${d.dateKey}`}>
            <Input id={`pn-${d.dateKey}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. Izin setengah hari" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" loading={busy} onClick={() => run(() => setPayDay(pay.staff.id, d.dateKey, amount, note, user), "Kompensasi disimpan")}>
            Simpan
          </Button>
          {d.compKind === "manual" && (
            <Button size="sm" variant="secondary" icon={<RotateCcw className="size-3.5" />} onClick={() => run(() => clearPayDay(pay.staff.id, d.dateKey), "Kembali ke hitungan otomatis")}>
              Kembali ke otomatis
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onEdit(false)}>
            Batal
          </Button>
        </div>
      </div>
    );

  // A day with patients has nothing to show here, only a way for the manager to add an amount.
  if (!idle && !d.compKind)
    return (
      <div className="border-t border-line-soft px-3.5 py-1.5 text-right">
        <button
          type="button"
          onClick={() => {
            setAmount(comp.amount);
            setNote("");
            onEdit(true);
          }}
          className="rounded-md px-1.5 py-1 text-[12px] font-semibold text-jade hover:bg-jade-mist"
        >
          Tambah kompensasi
        </button>
      </div>
    );

  return (
    <div className={cx("flex items-center gap-3 px-3.5 py-2.5 text-sm", d.sessions.length > 0 && "border-t border-line-soft")}>
      <span className="flex w-11 shrink-0 justify-start text-muted">
        <Clock className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{d.compensation > 0 || d.compKind ? "Kompensasi harian" : "Tidak ada pasien"}</p>
        {why && <p className="text-[13px] text-muted">{why}</p>}
      </div>
      {(d.compensation > 0 || d.compKind) && <span className="tnum shrink-0 font-semibold">{rupiah(d.compensation)}</span>}
      {manage && (
        <button
          type="button"
          aria-label={`Ubah kompensasi ${shortDate(d.dateKey)}`}
          onClick={() => {
            setAmount(d.compKind ? d.compensation : comp.amount);
            setNote(d.note ?? "");
            onEdit(true);
          }}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-line-soft hover:text-ink"
        >
          <Pencil className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** The rate a service pays under the current rules, for lists. */
export const serviceRateText = (s: CommissionSettings, sv: Row<Service>) => {
  const r = rateFor(s, sv.id);
  return r.type === "none" ? "Tanpa komisi" : `${rateText(r)} (${rupiah(rateAmount(r, sv.price))})`;
};
