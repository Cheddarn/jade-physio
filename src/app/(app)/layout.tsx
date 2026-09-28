"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";
import { AppShell, Logo } from "@/components/AppShell";
import { Button, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL, routeAllowed } from "@/lib/roles";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { state, signOut } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (state.status === "signed_out") router.replace("/login");
  }, [state.status, router]);

  if (state.status === "loading" || state.status === "signed_out") return <Spinner className="min-h-dvh" />;

  if (state.status === "no_access")
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <Logo />
        <div className="mt-10 flex size-12 items-center justify-center rounded-full bg-amber-mist text-amber">
          <ShieldCheck className="size-6" />
        </div>
        <h1 className="mt-4 text-xl font-bold">Akun belum punya akses</h1>
        <p className="mt-2 max-w-sm text-sm text-muted">
          Anda masuk sebagai <span className="font-semibold text-ink">{state.user.email}</span>. Minta admin
          menambahkan email ini di menu Terapis &amp; akses. Halaman ini akan terbuka otomatis setelah akses diberikan.
        </p>
        <div className="mt-6 flex gap-2">
          <Button variant="secondary" onClick={() => location.reload()}>
            Muat ulang
          </Button>
          <Button variant="ghost" onClick={signOut}>
            Keluar
          </Button>
        </div>
      </div>
    );

  if (!routeAllowed(state.user.role, path))
    return (
      <AppShell>
        <div className="flex flex-col items-center px-6 py-24 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-line-soft text-muted">
            <Lock className="size-5" />
          </div>
          <h1 className="mt-4 text-lg font-bold">Tidak ada akses ke halaman ini</h1>
          <p className="mt-1.5 max-w-sm text-sm text-muted">
            Akun Anda ({ROLE_LABEL[state.user.role]}) tidak punya akses ke menu ini. Hubungi admin jika perlu.
          </p>
          <Link href="/kalender" className="mt-5">
            <Button variant="secondary">Ke kalender</Button>
          </Link>
        </div>
      </AppShell>
    );

  return <AppShell>{children}</AppShell>;
}
