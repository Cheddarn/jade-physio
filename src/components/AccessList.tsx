"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Avatar, Badge, Button, Card, Confirm, Field, Input, Select, Sheet, Spinner, cx, errorText, useToast } from "./ui";
import { useUser } from "@/lib/auth";
import { ROLES, ROLE_HINT, ROLE_LABEL, type Role } from "@/lib/roles";
import { shortDate, staffColor } from "@/lib/format";
import { store, type Row } from "@/lib/store";
import type { Access, Staff } from "@/lib/types";

const ROLE_TONE: Record<Role, "jade" | "neutral" | "amber"> = { admin: "jade", staff: "neutral", therapist: "amber" };

export function AccessList({ staff, rows }: { staff: Row<Staff>[]; rows: Row<Access>[] | null }) {
  const toast = useToast();
  const me = useUser();
  const [editing, setEditing] = useState<Row<Access> | "new" | null>(null);
  const [removing, setRemoving] = useState<Row<Access> | null>(null);

  const order: Record<Role, number> = { admin: 0, staff: 1, therapist: 2 };
  const list = [...(rows ?? [])].sort((a, b) => order[a.role] - order[b.role] || a.addedAt - b.addedAt);

  return (
    <section className="mt-10">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold text-ink-2">Akses login</h2>
          <p className="text-[13px] text-muted">Hanya email di daftar ini yang bisa masuk. Peran menentukan menu yang terlihat.</p>
        </div>
        <Button size="sm" variant="secondary" icon={<Plus className="size-3.5" />} onClick={() => setEditing("new")}>
          Tambah
        </Button>
      </div>

      {rows === null ? (
        <Spinner />
      ) : (
        <Card className="divide-y divide-line-soft">
          {list.map((a) => {
            const st = a.role === "therapist" ? staff.find((s) => s.id === a.staffId) : undefined;
            const self = a.id === me.email;
            return (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={a.name || a.id} color={st ? staffColor(st.color) : undefined} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {a.name || a.id}
                    {self && <span className="ml-2 text-[13px] font-medium text-muted">(Anda)</span>}
                  </p>
                  <p className="truncate text-[13px] text-muted">
                    {a.id}
                    {a.role === "therapist" && (st ? `, kolom ${st.name}` : ", belum dihubungkan ke kolom")}
                  </p>
                </div>
                <Badge tone={ROLE_TONE[a.role]} className="hidden sm:inline-flex">
                  {ROLE_LABEL[a.role]}
                </Badge>
                {!self && (
                  <div className="flex shrink-0">
                    <button
                      onClick={() => setEditing(a)}
                      aria-label={`Ubah akses ${a.id}`}
                      className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-line-soft hover:text-ink"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => setRemoving(a)}
                      aria-label={`Cabut akses ${a.id}`}
                      className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-danger-mist hover:text-danger"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      <AccessSheet value={editing} staff={staff} existing={list} onClose={() => setEditing(null)} />

      <Confirm
        open={!!removing}
        title="Cabut akses?"
        body={`${removing?.id} langsung keluar dan tidak bisa membuka sistem lagi.`}
        confirmLabel="Cabut akses"
        tone="danger"
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          try {
            await store.remove("access", removing!.id);
            toast("Akses dicabut");
            setRemoving(null);
          } catch (e) {
            toast(errorText(e), "error");
          }
        }}
      />
    </section>
  );
}

function AccessSheet({
  value,
  staff,
  existing,
  onClose,
}: {
  value: Row<Access> | "new" | null;
  staff: Row<Staff>[];
  existing: Row<Access>[];
  onClose: () => void;
}) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [staffId, setStaffId] = useState("");
  const [busy, setBusy] = useState(false);
  const [openedFor, setOpenedFor] = useState<unknown>(null);
  if (value !== openedFor) {
    setOpenedFor(value);
    if (value === "new") {
      setEmail("");
      setName("");
      setRole("staff");
      setStaffId("");
    } else if (value) {
      setEmail(value.id);
      setName(value.name);
      setRole(value.role);
      setStaffId(value.staffId ?? "");
    }
  }
  const isNew = value === "new";
  const mail = email.trim().toLowerCase();
  const validEmail = /^\S+@\S+\.\S+$/.test(mail);
  const taken = isNew && existing.some((a) => a.id === mail);
  const usedColumn = (id: string) => existing.find((a) => a.role === "therapist" && a.staffId === id && a.id !== mail);

  function pickStaff(id: string) {
    setStaffId(id);
    const s = staff.find((x) => x.id === id);
    if (s && !name.trim()) setName(s.name);
  }

  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title={isNew ? "Tambah akses login" : "Ubah akses"}
      footer={
        <Button
          size="lg"
          block
          loading={busy}
          disabled={!validEmail || taken || (role === "therapist" && !staffId)}
          onClick={async () => {
            setBusy(true);
            try {
              const doc: Access = {
                role,
                name: name.trim(),
                addedAt: isNew ? Date.now() : (value as Row<Access>).addedAt,
                ...(role === "therapist" ? { staffId } : {}),
              };
              await store.set("access", mail, doc);
              toast(isNew ? `${mail} ditambahkan sebagai ${ROLE_LABEL[role]}` : "Akses diperbarui");
              onClose();
            } catch (e) {
              toast(errorText(e), "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          {isNew ? "Beri akses" : "Simpan"}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Email" htmlFor="ac-email" error={taken ? "Email ini sudah ada di daftar." : undefined}>
          <Input
            id="ac-email"
            type="email"
            value={email}
            disabled={!isNew}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@email.com"
          />
        </Field>

        <Field label="Peran">
          <div className="grid gap-2">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                aria-pressed={role === r}
                className={cx(
                  "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                  role === r ? "border-jade bg-jade-mist/50 ring-1 ring-jade" : "border-line hover:border-ink-2/30",
                )}
              >
                <span
                  className={cx(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                    role === r ? "border-jade bg-jade" : "border-line",
                  )}
                >
                  {role === r && <span className="size-1.5 rounded-full bg-white" />}
                </span>
                <span>
                  <span className="block text-sm font-semibold">{ROLE_LABEL[r]}</span>
                  <span className="block text-[13px] text-muted">{ROLE_HINT[r]}</span>
                </span>
              </button>
            ))}
          </div>
        </Field>

        {role === "therapist" && (
          <Field label="Kolom terapis di kalender" htmlFor="ac-staff" hint="Terapis hanya bisa memulai sesi untuk pasien di kolomnya.">
            <Select id="ac-staff" value={staffId} onChange={(e) => pickStaff(e.target.value)}>
              <option value="">Pilih terapis</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id} disabled={!!usedColumn(s.id)}>
                  {s.name}
                  {usedColumn(s.id) ? ` (sudah dipakai ${usedColumn(s.id)!.id})` : ""}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Nama" htmlFor="ac-name">
          <Input id="ac-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        {isNew && (
          <p className="rounded-xl bg-canvas px-4 py-3 text-sm text-ink-2">
            Setelah ditambahkan, orang ini membuka halaman masuk, memilih Daftar, lalu membuat kata sandi dengan email yang
            sama.
          </p>
        )}
        {!isNew && value && (
          <p className="text-[13px] text-muted">Ditambahkan {shortDate((value as Row<Access>).addedAt)}.</p>
        )}
      </div>
    </Sheet>
  );
}
