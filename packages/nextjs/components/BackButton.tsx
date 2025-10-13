"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export const BackButton = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasHistoryRef = useRef<boolean>(false);

  useEffect(() => {
    // Next.js App Router maintains an idx on history.state. idx > 0 implies in-app back is possible.
    const idx = (window.history.state as any)?.idx;
    const hasInAppHistory = typeof idx === "number" && idx > 0;
    hasHistoryRef.current = hasInAppHistory;
  }, []);

  const onBack = useCallback(() => {
    const idx = (window.history.state as any)?.idx;
    const hasInAppHistory = typeof idx === "number" && idx > 0;

    // If on a location page, always go home
    if (pathname?.startsWith("/location/")) {
      router.push("/?home=1");
      return;
    }

    // If on a listing page, prefer going back to its originating location
    if (pathname?.startsWith("/listing/")) {
      const fromParam = searchParams?.get("from");
      if (fromParam) {
        router.push(`/location/${encodeURIComponent(fromParam)}`);
        return;
      }
      try {
        const raw = localStorage.getItem("marketplace.defaultLocationData");
        if (raw) {
          const parsed = JSON.parse(raw);
          const id = parsed?.id as string | undefined;
          if (id) {
            router.push(`/location/${encodeURIComponent(id)}`);
            return;
          }
        }
      } catch {}
      router.push("/?home=1");
      return;
    }

    if (hasInAppHistory) {
      const handlePopstate = () => {
        try {
          const { pathname, search } = window.location;
          if (pathname === "/") {
            const params = new URLSearchParams(search);
            if (params.get("home") !== "1") {
              router.replace("/?home=1");
            }
          }
        } finally {
          window.removeEventListener("popstate", handlePopstate);
        }
      };
      window.addEventListener("popstate", handlePopstate, { once: true });
      router.back();
    } else {
      // Prefer returning to originating location if provided
      try {
        const url = new URL(window.location.href);
        const from = url.searchParams.get("from");
        if (from) {
          router.push(`/location/${encodeURIComponent(from)}`);
          return;
        }
        // Fallback to last known/default location from localStorage
        const raw = localStorage.getItem("marketplace.defaultLocationData");
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            const id = parsed?.id as string | undefined;
            if (id) {
              router.push(`/location/${encodeURIComponent(id)}`);
              return;
            }
          } catch {}
        }
      } catch {}
      router.push("/?home=1");
    }
  }, [router, pathname, searchParams]);

  return (
    <button type="button" className="btn btn-ghost btn-md" aria-label="Go back" onClick={onBack}>
      <span className="text-2xl">←</span>
    </button>
  );
};

export default BackButton;
