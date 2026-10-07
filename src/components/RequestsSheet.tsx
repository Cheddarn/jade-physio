"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Globe, UserCheck, UserPlus, X } from "lucide-react";
import { Badge, Button, Confirm, Field, Input, Select, Sheet, Textarea, cx, errorText, useToast } from "./ui";
import { useUser } from "@/lib/auth";
import { useCollection, useCustomers, useServices, useStaff } from "@/lib/hooks";
import { atTime, dateKey, hhmm, longDate, time } from "@/lib/format";
import { confirmRequest, matchCustomer, rejectRequest } from "@/lib/portal";
import { relationLabel } from "@/lib/relations";
import { GENDER_SHORT } from "@/lib/flow";
import type { Row } from "@/lib/store";
import type { BookingRequest, RelationKind } from "@/lib/types";

export function usePendingRequests(enabled = true) {
  const { rows } = useCollection<BookingRequest>(enabled ? "requests" : null, [["status", "==", "pending"]]);
  return useMemo(() => [...(rows ?? [])].sort((a, b) => a.startAt - b.startAt), [rows]);
}

/** Front desk: patients' own bookings from the portal, to confirm into the calendar. */
export function RequestsSheet({ open, onClose, focusId }: { open: boolean; onClose: () => void; focusId?: string | null }) {
  const requests = usePendingRequests();
  const batches = useMemo(() => {
    const m = new Map<string, Row<BookingRequest>[]>();
    for (const r of requests) m.set(r.batchId, [...(m.get(r.batchId) ?? []), r]);
    return [...m.values()];
  }, [requests]);
  return (
    <Sheet open={open} onClose={onClose} wide title={`Permintaan booking (${requests.length})`}>
      {requests.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Tidak ada permintaan yang menunggu. Pasien booking lewat portal pasien.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {batches.map((items) => (
            <div key={items[0].batchId} className={cx("rounded-xl border border-line", items.length > 1 && "border-2")}>
              <p className="flex flex-wrap items-center gap-x-2 border-b border-line-soft px-4 py-2.5 text-[13px] text-muted">
                <Globe className="size-3.5 text-jade" />
                Dari akun <span className="font-semibold text-ink">{items[0].accountName}</span> ({items[0].accountEmail})
                {items.length > 1 && <Badge tone="jade">{items.length} orang sekaligus</Badge>}
              </p>
              <div className="divide-y divide-line-soft">
                {items.map((r) => (
                  <RequestItem key={r.id} r={r} focused={focusId === r.id} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

function RequestItem({ r, focused }: { r: Row<BookingRequest>; focused: boolean }) {
  const user = useUser();
  const toast = useToast();
  const { customers } = useCustomers();
  const { staff } = useStaff();
  const { services } = useServices(true);
  const [open, setOpen] = useState(focused);
  const [staffId, setStaffId] = useState(r.staffId ?? "");
  const [day, setDay] = useState(r.dateKey);
  const [clock, setClock] = useState(hhmm(r.startAt));
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const match = matchCustomer(customers, r);
  // "Siapa saja": suggest a physio of the patient's gender; the desk can change it.
  useEffect(() => {
    if (staffId || !staff.length) return;
    const pick = staff.find((s) => r.gender && s.gender === r.gender) ?? staff[0];
    setStaffId(pick.id);
  }, [staff, staffId, r.gender]);
  const service = services.find((s) => s.id === r.serviceId);

  async function accept() {
    const st = staff.find((s) => s.id === staffId);
    if (!st) return toast("Pilih fisioterapis dulu", "error");
    if (!service) return toast("Layanan sudah tidak ada di katalog", "error");
    setBusy(true);
    try {
      await confirmRequest(r, { staff: st, service, startAt: atTime(day, clock), customers, by: user.email });
      toast(`Booking ${r.personName} dikonfirmasi, masuk kalender`);
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cx("px-4 py-3", focused && "bg-jade-mist/30")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold">
            {r.personName}
            {r.relation && r.relation !== "self" && (
              <span className="ml-1.5 text-[13px] font-medium text-muted">({relationLabel(r.relation as RelationKind, r.gender)} pemilik akun)</span>
            )}
          </p>
          <p className="text-[13px] text-muted">
            {r.phone}
            {r.gender ? `, ${GENDER_SHORT[r.gender].toLowerCase()}` : ""}
          </p>
          <p className="mt-1 text-sm">
            <span className="font-semibold">
              {longDate(r.startAt)}, {time(r.startAt)}
            </span>
            <span className="text-ink-2">
              , {r.serviceName}, {r.staffName ?? "fisioterapis siapa saja"}
            </span>
          </p>
          {r.complaint && <p className="mt-1.5 rounded-lg bg-canvas px-3 py-2 text-[13px]">Keluhan: {r.complaint}</p>}
          <p className={cx("mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold", match ? "text-jade-deep" : "text-amber")}>
            {match ? <UserCheck className="size-3.5" /> : <UserPlus className="size-3.5" />}
            {match ? `Pasien lama: ${match.name}` : "Pasien baru, otomatis didaftarkan saat dikonfirmasi"}
          </p>
        </div>
        {!open && (
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-mist hover:text-danger" icon={<X className="size-3.5" />} onClick={() => (setReason(""), setRejecting(true))}>
              Tolak
            </Button>
            <Button size="sm" icon={<Check className="size-3.5" />} onClick={() => setOpen(true)}>
              Terima
            </Button>
          </div>
        )}
      </div>
      {open && (
        <div className="mt-3 grid gap-3 rounded-xl bg-canvas p-3 sm:grid-cols-[1fr_auto_auto]">
          <Field label="Fisioterapis" htmlFor={`rq-st-${r.id}`}>
            <Select id={`rq-st-${r.id}`} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Pilih</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.gender ? ` (${GENDER_SHORT[s.gender].toLowerCase()})` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tanggal" htmlFor={`rq-d-${r.id}`}>
            <Input id={`rq-d-${r.id}`} type="date" min={dateKey()} value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
          <Field label="Jam" htmlFor={`rq-t-${r.id}`}>
            <Input id={`rq-t-${r.id}`} type="time" step={300} value={clock} onChange={(e) => setClock(e.target.value)} />
          </Field>
          <div className="flex gap-2 sm:col-span-3">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button loading={busy} icon={<Check className="size-4" />} onClick={accept} className="flex-1">
              Konfirmasi & masukkan ke kalender
            </Button>
          </div>
        </div>
      )}
      <Confirm
        open={rejecting}
        title={`Tolak permintaan ${r.personName}?`}
        body="Pasien melihat status dan catatan ini di portalnya."
        confirmLabel="Tolak"
        tone="danger"
        onClose={() => setRejecting(false)}
        onConfirm={async () => {
          try {
            await rejectRequest(r.id, reason, user.email);
            toast("Permintaan ditolak");
            setRejecting(false);
          } catch (e) {
            toast(errorText(e), "error");
          }
        }}
      >
        <Field label="Catatan untuk pasien" htmlFor={`rq-why-${r.id}`}>
          <Textarea id={`rq-why-${r.id}`} className="min-h-16" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="mis. Jam penuh, silakan pilih jam 15.00" />
        </Field>
      </Confirm>
    </div>
  );
}
