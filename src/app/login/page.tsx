"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/AppShell";
import { Beads } from "@/components/Beads";
import { Button, Field, Input, Segmented } from "@/components/ui";
import { authErrorMessage, useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { state, signIn, signUp, isFirstRun } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"masuk" | "daftar">("masuk");
  const [firstRun, setFirstRun] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (state.status === "ready" || state.status === "no_access") router.replace("/kalender");
  }, [state.status, router]);

  useEffect(() => {
    isFirstRun().then((f) => {
      setFirstRun(f);
      if (f) setMode("daftar");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "masuk") await signIn(email, password);
      else await signUp(name, email, password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh md:grid-cols-[1fr_minmax(420px,520px)]">
      <div className="relative hidden overflow-hidden bg-jade-deep md:block">
        <div className="absolute inset-0 flex flex-col justify-end p-12 text-white">
          <p className="max-w-md text-[34px] font-bold leading-[1.15] tracking-[-0.02em]">
            Jadwal terapis, checkout, dan paket sesi pasien dalam satu meja kasir.
          </p>
          <div className="mt-8 flex items-center gap-4 rounded-2xl bg-white/8 p-5 backdrop-blur">
            <div className="flex-1">
              <p className="text-sm font-semibold">Paket 5 sesi fisioterapi</p>
              <p className="text-[13px] text-white/60">Rina Wulandari</p>
              <Beads total={5} used={2} size={14} className="mt-3" />
            </div>
            <p className="text-right">
              <span className="text-3xl font-bold">3</span>
              <span className="text-sm text-white/60">/5</span>
              <span className="block text-xs text-white/60">sesi tersisa</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center px-6 py-10 sm:px-12">
        <Logo />
        <h1 className="mt-10 text-2xl font-bold tracking-[-0.01em]">
          {firstRun ? "Buat akun admin pertama" : mode === "masuk" ? "Masuk ke kasir" : "Daftar akun"}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {firstRun
            ? "Akun pertama otomatis menjadi admin. Admin bisa menambahkan email lain setelahnya."
            : mode === "masuk"
              ? "Untuk admin, staf kasir, dan terapis Jade Physio."
              : "Pakai email yang sudah ditambahkan admin (sebagai admin, kasir, atau terapis)."}
        </p>

        {!firstRun && (
          <Segmented
            className="mt-6 w-full"
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError("");
            }}
            options={[
              { value: "masuk", label: "Masuk" },
              { value: "daftar", label: "Daftar" },
            ]}
          />
        )}

        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          {mode === "daftar" && (
            <Field label="Nama" htmlFor="name">
              <Input id="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          )}
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Kata sandi" htmlFor="password" hint={mode === "daftar" ? "Minimal 6 karakter" : undefined}>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "masuk" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && <p className="rounded-lg bg-danger-mist px-3 py-2.5 text-sm text-danger">{error}</p>}
          <Button type="submit" size="lg" loading={busy} className="mt-2">
            {mode === "masuk" ? "Masuk" : firstRun ? "Buat akun admin" : "Daftar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
