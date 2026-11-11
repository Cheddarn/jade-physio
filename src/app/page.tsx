"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { HOME, homeFor } from "@/lib/roles";

/** Send everyone to their own start page: the manager to the dashboard, patients to the portal, the rest to the board. */
export default function Home() {
  const { state } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (state.status === "loading") return;
    if (state.status === "signed_out") router.replace("/login");
    else if (state.status === "ready") router.replace(homeFor(state.user.role));
    else router.replace(HOME);
  }, [state, router]);
  return <Spinner className="min-h-dvh" />;
}
