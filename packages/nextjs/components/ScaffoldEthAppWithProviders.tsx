"use client";

import { MiniappProvider } from "./MiniappProvider";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProgressBar as ProgressBar } from "next-nprogress-bar";
import { Toaster } from "react-hot-toast";
// import { Footer } from "~~/components/Footer";
import { Header } from "~~/components/Header";
import { useInitializeNativeCurrencyPrice } from "~~/hooks/scaffold-eth";
import scaffoldConfig from "~~/scaffold.config";
import { wagmiConfig } from "~~/services/web3/wagmiConfig";

const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => {
  useInitializeNativeCurrencyPrice();

  return (
    <>
      <div className={`flex flex-col min-h-screen `}>
        <Header />
        <main className="relative flex flex-col flex-1">{children}</main>
        {/* <Footer /> */}
      </div>
      <Toaster />
    </>
  );
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

export const ScaffoldEthAppWithProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}
      clientId={process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID as string}
      config={{
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
        loginMethods: scaffoldConfig.loginMethods,
        supportedChains: scaffoldConfig.targetNetworks,
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <MiniappProvider>
            <ProgressBar height="3px" color="#2299dd" />
            <ScaffoldEthApp>{children}</ScaffoldEthApp>
          </MiniappProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
};
