"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

interface User {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
}

interface MiniappContextType {
  user: User | null;
  isReady: boolean;
  isMiniApp: boolean;
  openLink: (url: string) => Promise<void>;
  composeCast: (params: { text: string; embeds?: string[] }) => Promise<void>;
  openProfile: (params: { fid?: number; username?: string }) => Promise<void>;
  openMiniApp: (url: string) => Promise<void>;
  clientAdded: boolean;
  addMiniApp: () => Promise<void>;
}

const MiniappContext = createContext<MiniappContextType | undefined>(undefined);

export const useMiniapp = () => {
  const context = useContext(MiniappContext);
  if (context === undefined) {
    throw new Error("useMiniapp must be used within a MiniappProvider");
  }
  return context;
};

interface MiniappProviderProps {
  children: React.ReactNode;
}

export const MiniappProvider = ({ children }: MiniappProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [clientAdded, setClientAdded] = useState(false);

  const composeCast = async ({ text, embeds = [] }: { text: string; embeds?: string[] }) => {
    try {
      if (isMiniApp) {
        const trimmed = embeds.filter(Boolean).slice(0, 2);
        const embedsTuple = ((): [] | [string] | [string, string] => {
          if (trimmed.length >= 2) return [trimmed[0], trimmed[1]] as [string, string];
          if (trimmed.length === 1) return [trimmed[0]] as [string];
          return [] as [];
        })();
        console.log("composeCast processing", text, embedsTuple);
        await sdk.actions.composeCast({ text, embeds: embedsTuple });

        return;
      }
      const url = new URL("https://farcaster.xyz/~/compose");
      url.searchParams.set("text", text);
      for (const e of embeds) url.searchParams.append("embeds[]", e);
      if (typeof window !== "undefined") window.open(url.toString(), "_blank");
    } catch (err) {
      console.error("composeCast error", err);
    }
  };

  const openLink = async (url: string) => {
    try {
      // Detect compose URLs (warpcast.com or farcaster.xyz)
      const parsed = new URL(url, typeof window !== "undefined" ? window.location.href : "https://local");
      const hostname = parsed.hostname.toLowerCase();
      const pathname = parsed.pathname;
      const isCompose =
        (hostname.includes("warpcast.com") || hostname.includes("farcaster.xyz")) && pathname === "/~/compose";

      if (isCompose) {
        const textParam = parsed.searchParams.get("text") || "";
        // URLSearchParams decodes automatically; replace "+" with space just in case
        const text = textParam.replace(/\+/g, " ");
        const embeds = parsed.searchParams.getAll("embeds[]");
        await composeCast({ text, embeds });
        return;
      }

      const inMiniApp = await sdk.isInMiniApp();
      if (inMiniApp) {
        await sdk.actions.openUrl(url);
      } else if (typeof window !== "undefined") {
        window.open(url, "_blank");
      }
    } catch (err) {
      console.error("openLink error", err);
      if (typeof window !== "undefined") window.open(url, "_blank");
    }
  };

  const openMiniApp = async (url: string) => {
    try {
      const inMiniApp = await sdk.isInMiniApp();
      if (inMiniApp) {
        await sdk.actions.openMiniApp({ url });
      } else {
        if (typeof window !== "undefined") window.open(url, "_blank");
      }
    } catch (err) {
      console.error("openMiniApp error", err);
    }
  };

  const openProfile = async (params: { fid?: number; username?: string }) => {
    try {
      const inMiniApp = await sdk.isInMiniApp();
      if (inMiniApp) {
        await sdk.actions.viewProfile(params as any);
        return;
      }
      if (params?.fid) {
        if (typeof window !== "undefined") window.open(`https://farcaster.xyz/~/profiles/${params.fid}`, "_blank");
      } else if (params?.username) {
        if (typeof window !== "undefined") window.open(`https://warpcast.com/${params.username}`, "_blank");
      }
    } catch (err) {
      console.error("openProfile error", err);
      if (params?.fid && typeof window !== "undefined") {
        window.open(`https://farcaster.xyz/~/profiles/${params.fid}`, "_blank");
      }
    }
  };

  useEffect(() => {
    sdk.actions
      .ready()
      .then(async () => {
        console.log("MiniApp SDK ready");
        const context = await sdk.context;
        const isMiniApp = await sdk.isInMiniApp();
        const user = context?.user ?? null;
        console.log("User", user);
        console.log("Is MiniApp", isMiniApp);
        // set the user to the context
        setUser(user as User);
        setIsMiniApp(isMiniApp);
        setClientAdded(Boolean(context?.client?.added));
        setIsReady(true);

        // Auto-prompt to add Mini App on first open
        try {
          if (isMiniApp && !Boolean(context?.client?.added)) {
            if (typeof window !== "undefined") {
              const ADD_PROMPT_KEY = "miniapp:addPrompted";
              const hasPrompted = window.localStorage.getItem(ADD_PROMPT_KEY);
              if (!hasPrompted) {
                window.localStorage.setItem(ADD_PROMPT_KEY, "1");
                try {
                  await sdk.actions.addMiniApp();
                } catch (e) {
                  console.log("Auto addMiniApp prompt failed or was rejected", e);
                }
                const updated = await sdk.context;
                setClientAdded(Boolean(updated?.client?.added));
              }
            }
          }
        } catch (e) {
          console.log("Auto addMiniApp prompt error", e);
        }

        // Integrate back navigation with web navigation when supported
        try {
          const capabilities = await sdk.getCapabilities();
          if (capabilities.includes("back")) {
            await sdk.back.enableWebNavigation();
          }
        } catch (e) {
          console.log("Back navigation integration error:", e);
        }

        // Expose miniapp data globally for templating systems
        if (typeof window !== "undefined") {
          (window as any).__MINIAPP_DATA__ = {
            user,
            isReady: true,
            isMiniApp,
          };

          // Emit custom event for event-based access
          window.dispatchEvent(
            new CustomEvent("miniapp-data-update", {
              detail: { user, isReady: true, isMiniApp },
            }),
          );
        }
      })
      .catch(error => {
        console.error("MiniApp SDK error", error);
        // Set default values on error
        if (typeof window !== "undefined") {
          (window as any).__MINIAPP_DATA__ = {
            user: null,
            isReady: false,
            isMiniApp: false,
          };
        }
      });
  }, []);

  const addMiniApp = async () => {
    try {
      await sdk.actions.addMiniApp();
      // Refresh context to reflect added state
      const ctx = await sdk.context;
      setClientAdded(Boolean(ctx?.client?.added));
    } catch (e) {
      console.error("addMiniApp error", e);
    }
  };

  const value = {
    user,
    isReady,
    isMiniApp,
    openLink,
    composeCast,
    openProfile,
    openMiniApp,
    clientAdded,
    addMiniApp,
  };

  return <MiniappContext.Provider value={value}>{children}</MiniappContext.Provider>;
};
