"use client";

import { useState } from "react";
import { Plus, UserCog } from "lucide-react";
import { Avatar, Badge, Button, Card, Empty, Field, Input, PageHeader, Sheet, Spinner, Switch, cx, errorText, useToast } from "@/components/ui";
import { AccessList } from "@/components/AccessList";
import { useCollection, useStaff } from "@/lib/hooks";
import { saveStaff } from "@/lib/actions";
import { STAFF_COLORS, staffColor } from "@/lib/format";
import type { Row } from "@/lib/store";
import { GENDER_LABEL } from "@/lib/flow";
import type { Access, Gender, Staff } from "@/lib/types";

export default function TimPage() {
  const { staff, loading } = useStaff(true);
  const { rows: access } = useCollection<Access>("access");
  const [edit, setEdit] = useState<Row<Staff> | "new" | null>(null);
  const loginFor = (staffId: string) => (access ?? []).find((a) => a.role === "therapist" && a.staffId === staffId);

  return (
    <div className="mx-auto max-w-4xl pb-10">
      <PageHeader
        title="Terapis & akses"
        subtitle="Kolom kalender untuk setiap terapis, dan siapa saja yang boleh masuk beserta perannya"
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEdit("new")}>
            Terapis baru
          </Button>
        }
      />
      <div className="px-4 md:px-8">
        <h2 className="mb-2 text-[13px] font-semibold text-ink-2">Terapis</h2>
        {loading ? (
          <Spinner />
        ) : staff.length === 0 ? (
          <Card>
            <Empty
              icon={<UserCog className="size-5" />}
              title="Belum ada terapis"
              body="Setiap terapis mendapat satu kolom di kalender."
              action={<Button onClick={() => setEdit("new")}>Tambah terapis</Button>}
            />
          </Card>
        ) : (
          <Card className="divide-y divide-line-soft">
            {staff.map((s) => {
              const c = staffColor(s.color);
              return (
                <button key={s.id} onClick={() => setEdit(s)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-canvas">
                  <Avatar name={s.name.replace(/^Ft\.\s*/, "")} color={c} />
                  <div className="min-w-0 flex-1">
                    <p className={cx("truncate font-semibold", !s.active && "text-muted")}>{s.name}</p>
                    <p className="truncate text-[13px] text-muted">
                      {s.gender ? `Spesialis ${GENDER_LABEL[s.gender].toLowerCase()}, ` : "Jenis kelamin belum diisi, "}
                      {loginFor(s.id) ? `login: ${loginFor(s.id)!.id}` : "belum punya login"}
                    </p>
                  </div>
                  {!s.active && <Badge>Nonaktif</Badge>}
                </button>
              );
            })}
          </Card>
        )}

        <AccessList staff={staff} rows={access} />
      </div>

      <StaffForm value={edit} nextOrder={(staff.at(-1)?.order ?? 0) + 1} onClose={() => setEdit(null)} />
    </div>
  );
}

function StaffForm({ value, nextOrder, onClose }: { value: Row<Staff> | "new" | null; nextOrder: number; onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<Staff>({ name: "", color: "jade", active: true, order: 1 });
  const [openedFor, setOpenedFor] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  if (value !== openedFor) {
    setOpenedFor(value);
    if (value === "new") setForm({ name: "", color: Object.keys(STAFF_COLORS)[(nextOrder - 1) % 8], active: true, order: nextOrder });
    else if (value) setForm({ name: value.name, color: value.color, active: value.active, order: value.order, gender: value.gender });
  }
  const isNew = value === "new";

  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title={isNew ? "Terapis baru" : "Ubah terapis"}
      footer={
        <Button
          size="lg"
          block
          loading={busy}
          disabled={!form.name.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await saveStaff(isNew ? null : (value as Row<Staff>).id, { ...form, name: form.name.trim() });
              toast(isNew ? "Terapis ditambahkan" : "Terapis disimpan");
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
      <div className="flex flex-col gap-5">
        <Field label="Nama" htmlFor="st-name">
          <Input id="st-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="mis. Ft. Andini" />
        </Field>
        <Field label="Jenis kelamin" hint="Front desk memanggil terapis pria atau wanita sesuai kebutuhan pasien.">
          <div className="grid grid-cols-2 gap-2">
            {(["L", "P"] as Gender[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setForm({ ...form, gender: g })}
                aria-pressed={form.gender === g}
                className={cx(
                  "h-11 rounded-xl border text-sm font-semibold transition-colors",
                  form.gender === g ? "border-jade bg-jade-mist/50 ring-1 ring-jade" : "border-line hover:border-ink-2/30",
                )}
              >
                {GENDER_LABEL[g]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Warna di kalender">
          <div className="flex flex-wrap gap-2">
            {Object.entries(STAFF_COLORS).map(([key, c]) => (
              <button
                key={key}
                type="button"
                onClick={() => setForm({ ...form, color: key })}
                aria-label={c.name}
                aria-pressed={form.color === key}
                className={cx(
                  "flex h-10 items-center gap-2 rounded-full border pr-3.5 pl-2 text-[13px] font-semibold",
                  form.color === key ? "border-transparent ring-2" : "border-line",
                )}
                style={form.color === key ? { background: c.bg, color: c.fg, ["--tw-ring-color" as string]: c.dot } : undefined}
              >
                <span className="size-5 rounded-full" style={{ background: c.dot }} />
                {c.name}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Urutan kolom" htmlFor="st-order" hint="Angka kecil tampil paling kiri di kalender">
          <Input id="st-order" type="number" min={1} value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) || 1 })} />
        </Field>
        <div className="rounded-xl bg-canvas p-3.5">
          <Switch checked={form.active} onChange={(active) => setForm({ ...form, active })} label="Aktif, tampil di kalender" />
        </div>
      </div>
    </Sheet>
  );
}

