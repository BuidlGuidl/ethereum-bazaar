"use client";

// @refresh reset
import { useEffect } from "react";
import { Balance } from "../Balance";
import { AddressInfoDropdown } from "./AddressInfoDropdown";
import { AddressQRCodeModal } from "./AddressQRCodeModal";
import { RevealBurnerPKModal } from "./RevealBurnerPKModal";
import { WrongNetworkDropdown } from "./WrongNetworkDropdown";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { usePrivyWagmi } from "@privy-io/wagmi";
import { Address } from "viem";
import { normalize } from "viem/ens";
import { useAccount, useEnsAvatar, useEnsName } from "wagmi";
import { useNetworkColor } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { getBlockExplorerAddressLink } from "~~/utils/scaffold-eth";

/**
 * Custom Privy Connect Button (watch balance + custom design)
 */
export const RainbowKitCustomConnectButton = () => {
  const networkColor = useNetworkColor();
  const { targetNetwork } = useTargetNetwork();
  const { authenticated, ready: privyReady, login, connectWallet } = usePrivy();
  const { wallets } = useWallets();
  const { setActiveWallet } = usePrivyWagmi();
  const { address, chain, chainId, isConnected, isConnecting } = useAccount();

  useEffect(() => {
    if (isConnecting || address) {
      return;
    }

    if (privyReady && authenticated && wallets.length > 0 && !address) {
      const embeddedWallet = wallets.find(w => w.walletClientType === "privy");
      if (embeddedWallet) {
        setActiveWallet(embeddedWallet);
      }
    }
  }, [privyReady, authenticated, wallets, address, isConnecting, setActiveWallet]);

  const { data: ensName } = useEnsName({
    address: address as Address,
    chainId: 1,
    query: {
      enabled: Boolean(address),
      gcTime: 30_000,
    },
  });

  const { data: ensAvatar } = useEnsAvatar({
    name: ensName ? normalize(ensName) : undefined,
    chainId: 1,
    query: {
      enabled: Boolean(ensName),
      gcTime: 30_000,
    },
  });

  const mounted = privyReady;
  const hasWallet = wallets.length > 0 || isConnected;
  const connected = mounted && authenticated && address;
  const isStillConnecting = authenticated && hasWallet && !address && !isConnecting;

  const blockExplorerAddressLink = address ? getBlockExplorerAddressLink(targetNetwork, address) : undefined;

  const displayName = ensName || (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "");

  const handleConnect = () => {
    if (authenticated) {
      if (!hasWallet) {
        connectWallet();
      }
      return;
    }
    login();
  };

  return (
    <>
      {(() => {
        if (!mounted) {
          return null;
        }

        // Show connecting state if authenticated with wallets but wagmi hasn't synced yet
        if (isStillConnecting) {
          return (
            <button className="btn btn-primary btn-sm" disabled type="button">
              Connecting...
            </button>
          );
        }

        // Show connect button if not connected
        if (!connected) {
          return (
            <button className="btn btn-primary btn-sm" onClick={handleConnect} type="button">
              Connect Wallet
            </button>
          );
        }

        if (chainId && chainId !== targetNetwork.id) {
          return <WrongNetworkDropdown />;
        }

        // Show connected state
        return (
          <>
            <div className="flex flex-col items-center mr-1">
              <Balance address={address as Address} className="min-h-0 h-auto" />
              {chain && (
                <span className="text-xs" style={{ color: networkColor }}>
                  {chain.name}
                </span>
              )}
            </div>
            <AddressInfoDropdown
              address={address as Address}
              displayName={displayName}
              ensAvatar={(ensAvatar ?? undefined) as string | undefined}
              blockExplorerAddressLink={blockExplorerAddressLink}
            />
            <AddressQRCodeModal address={address as Address} modalId="qrcode-modal" />
            <RevealBurnerPKModal />
          </>
        );
      })()}
    </>
  );
};
