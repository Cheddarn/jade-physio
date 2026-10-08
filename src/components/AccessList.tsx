"use client";

import { useState } from "react";
import { CheckCircle2, Copy, KeyRound, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Avatar, Badge, Button, Card, Confirm, Field, Input, Select, Sheet, Spinner, cx, errorText, useToast } from "./ui";
import { authErrorMessage, createLogin, sendPasswordReset, useUser } from "@/lib/auth";
import { ROLES, ROLE_HINT, ROLE_LABEL, normalizeRole, type Role } from "@/lib/roles";
import { shortDate, staffColor } from "@/lib/format";
import { store, type Row } from "@/lib/store";
import type { Access, Staff } from "@/lib/types";
import { saveTeamMember } from "@/lib/settings";
import { STAFF_ROLES } from "@/lib/roles";

const ROLE_TONE: Record<Role, "jade" | "neutral" | "amber" | "outline"> = {
  admin: "jade",
  manager: "jade",
  therapist: "amber",
  cleaning: "outline",
  patient: "outline",
};

export function AccessList({ staff, rows }: { staff: Row<Staff>[]; rows: Row<Access>[] | null }) {
  const toast = useToast();
  const me = useUser();
  const [editing, setEditing] = useState<Row<Access> | "new" | null>(null);
  const [removing, setRemoving] = useState<Row<Access> | null>(null);

  const order: Record<Role, number> = { admin: 0, manager: 1, therapist: 2, cleaning: 3, patient: 4 };
  // Old front desk logins are stored as "staff"; show and edit them as Admin. Unknown roles are left out.
  const known = (rows ?? []).flatMap((a) => {
    const role = normalizeRole(a.role);
    return role ? [{ ...a, role }] : [];
  });
  // Patients register themselves; they're counted below, not listed with the staff.
  const list = known.filter((a) => a.role !== "patient").sort((a, b) => order[a.role] - order[b.role] || a.addedAt - b.addedAt);
  const patients = known.filter((a) => a.role === "patient").length;

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

      {patients > 0 && (
        <p className="mt-2 text-[13px] text-muted">{patients} akun pasien mendaftar sendiri lewat halaman masuk (portal booking).</p>
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
            await saveTeamMember(removing!.id, { active: false }).catch(() => {});
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

const PASSWORD_CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Easy to read out or type: no 0/O or 1/l/I. */
function newPassword(length = 10) {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join("");
}

/** What to hand the new person, ready to paste into WhatsApp. */
function loginText(name: string, email: string, password: string) {
  return [
    `Akun Jade Physio untuk ${name}`,
    `Masuk di: ${window.location.origin}/login`,
    `Email: ${email}`,
    `Kata sandi: ${password}`,
    "",
    "Kata sandi bisa diganti kapan saja lewat \"Lupa kata sandi?\" di halaman masuk.",
  ].join("\n");
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
  // New logins start with no role, so nobody gets full Admin access by accident.
  const [role, setRole] = useState<Role | null>(null);
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  // After creating: the login to hand over (password null when the email already had one).
  const [done, setDone] = useState<{ name: string; email: string; password: string | null } | null>(null);
  const [openedFor, setOpenedFor] = useState<unknown>(null);
  if (value !== openedFor) {
    setOpenedFor(value);
    setDone(null);
    if (value === "new") {
      setEmail("");
      setName("");
      setRole(null);
      setStaffId("");
      setPassword(newPassword());
    } else if (value) {
      setEmail(value.id);
      setName(value.name);
      setRole(value.role);
      setStaffId(value.staffId ?? "");
      setPassword("");
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

  async function save() {
    if (!role) return;
    setBusy(true);
    try {
      const doc: Access = {
        role,
        name: name.trim(),
        addedAt: isNew ? Date.now() : (value as Row<Access>).addedAt,
        ...(role === "therapist" ? { staffId } : {}),
      };
      // The login first: if it cannot be made, nobody is added to the list.
      const login = isNew ? await createLogin(mail, password, doc.name || mail) : null;
      await store.set("access", mail, doc);
      // Keep the team directory (shifts, sellers) in step with logins.
      if (STAFF_ROLES.includes(role)) await saveTeamMember(mail, { name: doc.name || mail, role, staffId: doc.staffId ?? "", active: true });
      if (isNew) setDone({ name: doc.name || mail, email: mail, password: login === "created" ? password : null });
      else {
        toast("Akses diperbarui");
        onClose();
      }
    } catch (e) {
      toast((e as { code?: string })?.code?.startsWith("auth/") ? authErrorMessage(e) : errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function copyLogin() {
    if (!done?.password) return;
    const text = loginText(done.name, done.email, done.password);
    try {
      await navigator.clipboard.writeText(text);
      toast("Info masuk disalin");
    } catch {
      window.prompt("Salin info masuk:", text);
    }
  }

  async function reset() {
    setResetting(true);
    try {
      await sendPasswordReset(mail);
      toast(`Link atur ulang kata sandi dikirim ke ${mail}`);
    } catch (e) {
      toast(authErrorMessage(e), "error");
    } finally {
      setResetting(false);
    }
  }

  if (done)
    return (
      <Sheet
        open={!!value}
        onClose={onClose}
        title="Akun siap"
        footer={
          <div className="flex gap-2">
            {done.password && (
              <Button variant="secondary" size="lg" icon={<Copy className="size-4" />} onClick={copyLogin} className="flex-1">
                Salin info masuk
              </Button>
            )}
            <Button size="lg" onClick={onClose} className="flex-1">
              Selesai
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-xl bg-jade-mist px-4 py-3 text-sm text-jade-deep">
            <CheckCircle2 className="size-5 shrink-0" />
            <p>
              <span className="font-semibold">{done.name}</span> sudah bisa masuk sebagai {role ? ROLE_LABEL[role] : "staf"}.
            </p>
          </div>
          <dl className="divide-y divide-line-soft rounded-xl border border-line text-sm">
            <div className="flex justify-between gap-3 px-4 py-3">
              <dt className="text-muted">Email</dt>
              <dd className="font-semibold break-all">{done.email}</dd>
            </div>
            <div className="flex justify-between gap-3 px-4 py-3">
              <dt className="text-muted">Kata sandi</dt>
              <dd className="font-mono font-semibold">{done.password ?? "Tidak diubah"}</dd>
            </div>
          </dl>
          <p className="text-[13px] text-muted">
            {done.password
              ? "Kirim info masuk ini ke orangnya. Kata sandinya bisa ia ganti lewat Lupa kata sandi? di halaman masuk."
              : "Email ini sudah punya akun login, jadi kata sandinya tetap yang lama. Kalau lupa, ia bisa memakai Lupa kata sandi? di halaman masuk."}
          </p>
        </div>
      </Sheet>
    );

  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title={isNew ? "Buat akun login" : "Ubah akses"}
      footer={
        <Button
          size="lg"
          block
          loading={busy}
          disabled={!validEmail || taken || !role || (role === "therapist" && !staffId) || (isNew && password.length < 6)}
          onClick={save}
        >
          {isNew ? "Buat akun" : "Simpan"}
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
            {ROLES.filter((r) => r !== "patient").map((r) => (
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
          <Field label="Kata sandi awal" htmlFor="ac-password" hint="Minimal 6 karakter. Orangnya bisa menggantinya nanti.">
            <div className="flex gap-2">
              <Input
                id="ac-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
              />
              <Button variant="secondary" icon={<RefreshCw className="size-4" />} onClick={() => setPassword(newPassword())} className="shrink-0">
                Buat baru
              </Button>
            </div>
          </Field>
        )}

        {isNew && (
          <p className="rounded-xl bg-canvas px-4 py-3 text-sm text-ink-2">
            Akun langsung aktif. Setelah dibuat, salin info masuknya dan kirim ke orangnya.
          </p>
        )}
        {!isNew && value && (
          <div className="flex flex-col gap-3 border-t border-line-soft pt-5">
            <Button variant="secondary" icon={<KeyRound className="size-4" />} loading={resetting} onClick={reset}>
              Kirim email atur ulang kata sandi
            </Button>
            <p className="text-[13px] text-muted">Ditambahkan {shortDate((value as Row<Access>).addedAt)}.</p>
          </div>
        )}
      </div>
    </Sheet>
  );
}
