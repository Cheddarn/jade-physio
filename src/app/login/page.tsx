"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, CalendarCheck2, CheckCircle2, ClipboardList, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/AppShell";
import { Button, Field, Input, PasswordInput } from "@/components/ui";
import { authErrorMessage, localPhone, sendPasswordReset, toE164, useAuth } from "@/lib/auth";
import { HOME, homeFor } from "@/lib/roles";

/**
 * hp → kode: patients sign in (and sign up) with their phone number and an SMS code; a new number then fills in lengkapi.
 * email / lupa: staff and accounts the admin made. setup: the very first (admin) account.
 */
type View = "hp" | "kode" | "lengkapi" | "email" | "lupa" | "setup";

const RESEND_AFTER = 30;

/** "081234567890" or "+6281234567890" as "0812 3456 7890". */
function prettyPhone(phone: string) {
  const local = localPhone(phone.startsWith("+") ? phone : toE164(phone));
  return local.replace(/^(\d{4})(\d{4})(\d+)$/, "$1 $2 $3");
}

export default function LoginPage() {
  const { state, signIn, signUp, sendCode, verifyCode, registerPatient, isFirstRun } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<View>("hp");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (state.status === "ready") router.replace(homeFor(state.user.role));
    else if (state.status === "no_access") {
      // A phone number that was verified earlier but never finished registering: finish here.
      if (state.user.email.startsWith("+")) {
        setPhone(state.user.email);
        setView("lengkapi");
      } else router.replace(HOME);
    }
  }, [state, router]);

  useEffect(() => {
    isFirstRun().then((first) => first && setView("setup"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const go = (v: View) => {
    setView(v);
    setError("");
    setSent(false);
  };

  async function run(fn: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const sendSms = () =>
    run(async () => {
      await sendCode(phone, "recaptcha-box");
      setCode("");
      setResendIn(RESEND_AFTER);
      setView("kode");
    });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (view === "hp") return sendSms();
    if (view === "kode")
      return run(async () => {
        if ((await verifyCode(code)) === "new") setView("lengkapi");
      });
    if (view === "lengkapi") return run(() => registerPatient(name, email));
    if (view === "email") return run(() => signIn(email, password));
    if (view === "setup") return run(() => signUp(name, email, password));
    return run(async () => {
      await sendPasswordReset(email);
      setSent(true);
    });
  }

  const copy: Record<View, { title: string; sub: React.ReactNode; submit: string }> = {
    hp: { title: "Masuk", sub: "Masukkan nomor HP Anda. Kami kirim kode lewat SMS.", submit: "Kirim kode" },
    kode: {
      title: "Masukkan kode",
      sub: (
        <>
          Kode 6 angka sudah dikirim lewat SMS ke <span className="font-semibold text-ink">{phone && prettyPhone(phone)}</span>.
        </>
      ),
      submit: "Verifikasi",
    },
    lengkapi: {
      title: "Lengkapi pendaftaran",
      sub: (
        <>
          Nomor <span className="font-semibold text-ink">{phone && prettyPhone(phone)}</span> belum terdaftar. Isi nama Anda untuk membuat akun pasien.
        </>
      ),
      submit: "Buat akun",
    },
    email: { title: "Masuk dengan email", sub: "Untuk staf klinik dan akun yang dibuat admin.", submit: "Masuk" },
    lupa: { title: "Lupa kata sandi", sub: "Masukkan email akun Anda. Kami kirim link untuk membuat kata sandi baru.", submit: "Kirim link" },
    setup: { title: "Siapkan akun admin", sub: "Belum ada akun di sistem. Akun pertama ini menjadi admin klinik.", submit: "Buat akun admin" },
  };
  const back: Partial<Record<View, View>> = { kode: "hp", lupa: "email" };

  return (
    <div className="min-h-dvh bg-surface md:grid md:grid-cols-[minmax(0,1fr)_minmax(460px,560px)]">
      <BrandPanel />

      <main className="flex min-h-dvh flex-col px-6 pt-8 pb-6 sm:px-10 md:justify-center md:py-12">
        <div className="mx-auto w-full max-w-[400px]">
          <Logo className="md:hidden" />

          {back[view] && (
            <button
              type="button"
              onClick={() => go(back[view]!)}
              className="mt-10 -ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm font-semibold text-muted hover:text-ink md:mt-0"
            >
              <ArrowLeft className="size-4" />
              {view === "kode" ? "Ganti nomor" : "Kembali"}
            </button>
          )}

          <h1 className={back[view] ? "mt-4 text-[26px] font-bold tracking-[-0.02em]" : "mt-10 text-[26px] font-bold tracking-[-0.02em] md:mt-0"}>
            {copy[view].title}
          </h1>
          <p className="mt-1.5 text-[15px] text-muted">{copy[view].sub}</p>

          {sent ? (
            <div role="status" className="mt-8 flex items-start gap-2.5 rounded-xl bg-jade-mist px-4 py-3.5 text-sm text-jade-deep">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <p>
                Jika <span className="font-semibold">{email.trim()}</span> terdaftar, link untuk membuat kata sandi baru sudah dikirim. Cek juga folder spam.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
              {view === "hp" && (
                <Field label="Nomor HP" htmlFor="phone">
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0812 3456 7890"
                  />
                </Field>
              )}
              {view === "kode" && (
                <Field label="Kode verifikasi" htmlFor="code">
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    className="tnum text-center text-lg tracking-[0.4em]"
                  />
                </Field>
              )}
              {(view === "lengkapi" || view === "setup") && (
                <Field label="Nama lengkap" htmlFor="name">
                  <Input id="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
              )}
              {(view === "email" || view === "lupa" || view === "setup" || view === "lengkapi") && (
                <Field label={view === "lengkapi" ? "Email (opsional)" : "Email"} htmlFor="email">
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required={view !== "lengkapi"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                  />
                </Field>
              )}
              {(view === "email" || view === "setup") && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="password" className="text-[13px] font-semibold text-ink-2">
                      Kata sandi
                    </label>
                    {view === "email" && (
                      <button type="button" onClick={() => go("lupa")} className="text-[13px] font-semibold text-jade hover:text-jade-deep">
                        Lupa kata sandi?
                      </button>
                    )}
                  </div>
                  <PasswordInput
                    id="password"
                    autoComplete={view === "email" ? "current-password" : "new-password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  {view === "setup" && <p className="text-[13px] text-muted">Minimal 6 karakter.</p>}
                </div>
              )}

              {error && (
                <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-mist px-3.5 py-3 text-sm text-danger">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" block loading={busy} className="mt-2">
                {copy[view].submit}
              </Button>

              {view === "kode" && (
                <p className="text-center text-sm text-muted">
                  {resendIn > 0 ? (
                    <>Kirim ulang kode dalam {resendIn} detik</>
                  ) : (
                    <button type="button" onClick={sendSms} disabled={busy} className="font-semibold text-jade hover:text-jade-deep">
                      Kirim ulang kode
                    </button>
                  )}
                </p>
              )}
            </form>
          )}

          {view === "hp" && (
            <div className="mt-8 border-t border-line-soft pt-6 text-sm">
              <p className="text-muted">Pasien baru juga mulai di sini: setelah kode diverifikasi, cukup isi nama untuk membuat akun.</p>
              <p className="mt-3 text-muted">
                Staf klinik?{" "}
                <button type="button" onClick={() => go("email")} className="font-semibold text-jade hover:text-jade-deep">
                  Masuk dengan email
                </button>
              </p>
            </div>
          )}
          {view === "email" && (
            <div className="mt-8 border-t border-line-soft pt-6 text-sm">
              <p className="text-muted">
                Pasien?{" "}
                <button type="button" onClick={() => go("hp")} className="font-semibold text-jade hover:text-jade-deep">
                  Masuk dengan nomor HP
                </button>
              </p>
              <p className="mt-2 text-[13px] text-muted">Akun staf dan klinik dibuat oleh admin. Hubungi admin jika belum punya.</p>
            </div>
          )}
          {view === "lupa" && sent && (
            <Button variant="secondary" size="lg" block className="mt-4" onClick={() => go("email")}>
              Kembali ke halaman masuk
            </Button>
          )}

          {/* Firebase's invisible reCAPTCHA for the SMS lives here, so resending works from any view. */}
          <div id="recaptcha-box" />
        </div>

        <p className="mt-auto pt-10 text-center text-xs text-muted md:hidden">© {new Date().getFullYear()} Jade Physio</p>
      </main>
    </div>
  );
}

/** Desktop only: a quiet brand panel beside the form. */
function BrandPanel() {
  const points = [
    { icon: CalendarCheck2, text: "Booking sesi dan jadwal terapi" },
    { icon: ClipboardList, text: "Riwayat dan laporan terapi" },
    { icon: ShieldCheck, text: "Akses sesuai peran, data pasien terjaga" },
  ];
  return (
    <aside className="relative hidden overflow-hidden bg-jade-deep text-white md:flex md:flex-col md:justify-between md:p-12 lg:p-16">
      {/* Soft light, so the panel is not a flat block of colour. */}
      <div className="pointer-events-none absolute -top-40 -right-32 size-[520px] rounded-full bg-white/[0.06]" aria-hidden />
      <div className="pointer-events-none absolute -bottom-48 -left-24 size-[460px] rounded-full bg-black/[0.12]" aria-hidden />

      {/* The logo's own green is close to the panel's: a light ring keeps its edge. */}
      <span className="relative inline-flex items-center gap-3">
        <img src="/logo.png" width={40} height={40} alt="" className="size-10 rounded-lg ring-1 ring-white/30" />
        <span className="text-xl font-bold tracking-[-0.01em]">Jade Physio</span>
      </span>

      <div className="relative max-w-md">
        <p className="text-[34px] leading-[1.15] font-bold tracking-[-0.02em] lg:text-[40px]">Selamat datang di Jade Physio</p>
        <p className="mt-4 text-[17px] leading-relaxed text-white/75">Satu akun untuk pasien dan tim klinik.</p>
        <ul className="mt-10 flex flex-col gap-4">
          {points.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-[15px] text-white/90">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <Icon className="size-[18px]" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-sm text-white/55">© {new Date().getFullYear()} Jade Physio</p>
    </aside>
  );
}
