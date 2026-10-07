"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Runs `run` once when the URL carries `?<name>=…` (from quick search),
 * then drops the parameter so a reload does not repeat it.
 */
export function QueryAction({ name, run }: { name: string; run: () => void }) {
  return (
    <Suspense fallback={null}>
      <Watch name={name} run={run} />
    </Suspense>
  );
}

function Watch({ name, run }: { name: string; run: () => void }) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const value = params.get(name);
  useEffect(() => {
    if (!value) return;
    run();
    const rest = new URLSearchParams(params);
    rest.delete(name);
    router.replace(rest.size ? `${path}?${rest}` : path, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return null;
}
