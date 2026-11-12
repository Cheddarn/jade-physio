"use client";

import { useEffect, useRef } from "react";
import { Scale, UserCheck } from "lucide-react";
import { Select, cx, errorText, useToast } from "./ui";
import { firstTherapist, setOwnTherapist, type Advice, type StaffLoad } from "@/lib/assign";
import { useStaff } from "@/lib/hooks";
import type { Row } from "@/lib/store";
import type { Booking, Customer, Staff } from "@/lib/types";

/**
 * Picks the suggested physio until the desk picks one themselves, and follows the suggestion while it is still
 * the one in use (another patient, another date). A physio chosen by hand is never replaced.
 */
export function useAutoPick(advice: Advice | null, staffId: string, setStaffId: (id: string) => void, active: boolean) {
  const auto = useRef<string | null>(null);
  useEffect(() => {
    if (!active) {
      auto.current = null;
      return;
    }
    if (!advice) return;
    if (staffId && staffId !== auto.current) return;
    auto.current = advice.staffId;
    if (staffId !== advice.staffId) setStaffId(advice.staffId);
  }, [advice, staffId, setStaffId, active]);
}

/** Who is suggested and why, and how many patients each physio has this month. */
export function TherapistAdvice({
  advice,
  loads,
  staff,
  selected,
  onUse,
  className,
}: {
  advice: Advice | null;
  loads: Map<string, StaffLoad>;
  staff: Row<Staff>[];
  selected: string;
  onUse: (staffId: string) => void;
  className?: string;
}) {
  if (!advice) return null;
  const pick = staff.find((s) => s.id === advice.staffId);
  if (!pick) return null;
  const used = selected === advice.staffId;
  const Icon = advice.kind === "own" ? UserCheck : Scale;
  return (
    <div className={cx("rounded-xl border px-3.5 py-2.5", used ? "border-jade/40 bg-jade-mist/40" : "border-amber/40 bg-amber-mist/50", className)}>
      <div className="flex items-start gap-2.5">
        <Icon className={cx("mt-0.5 size-4 shrink-0", used ? "text-jade" : "text-amber")} />
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink-2">
          <span className="font-bold text-ink">Disarankan: {pick.name}.</span> {advice.text}
        </p>
        {!used && (
          <button type="button" onClick={() => onUse(advice.staffId)} className="shrink-0 rounded-lg bg-ink px-2.5 py-1 text-[12px] font-semibold text-white">
            Pakai
          </button>
        )}
      </div>
      <p className="tnum mt-1.5 pl-[26px] text-[12px] text-muted">
        Pasien bulan ini: {staff.map((s) => `${s.name.replace(/^Ft\.\s*/, "")} ${loads.get(s.id)?.patients ?? 0}`).join(", ")}
      </p>
    </div>
  );
}

/** On the patient's page: whose patient this is, and a way for the desk to change it. */
export function OwnTherapist({ customer, history, canEdit, className }: { customer: Row<Customer>; history: Booking[]; canEdit: boolean; className?: string }) {
  const { staff } = useStaff();
  const toast = useToast();
  const first = staff.find((s) => s.id === firstTherapist(history)) ?? null;
  const set = staff.find((s) => s.id === customer.primaryStaffId) ?? null;
  const own = set ?? first;
  return (
    <div className={cx("flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3", className)}>
      <UserCheck className="size-5 shrink-0 text-jade" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-muted">Fisioterapis tetap</p>
        <p className="font-semibold">{own?.name ?? "Belum ada"}</p>
        <p className="text-[12px] text-muted">
          {set
            ? "Diatur oleh admin."
            : first
              ? "Yang pertama kali menangani pasien ini."
              : "Pasien baru. Saat booking, sistem menyarankan fisioterapis dengan pasien paling sedikit bulan itu."}
        </p>
      </div>
      {canEdit && (
        <Select
          aria-label="Ganti fisioterapis tetap"
          className="!h-10 w-full sm:!w-56"
          value={set?.id ?? ""}
          onChange={async (e) => {
            try {
              await setOwnTherapist(customer.id, e.target.value || null);
              toast(e.target.value ? "Fisioterapis tetap diganti" : "Kembali ke fisioterapis pertama");
            } catch (err) {
              toast(errorText(err), "error");
            }
          }}
        >
          <option value="">Otomatis{first ? ` (${first.name})` : ""}</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
