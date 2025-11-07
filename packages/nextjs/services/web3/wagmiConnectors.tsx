import { farcasterMiniApp as miniAppConnector } from "@farcaster/miniapp-wagmi-connector";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  baseAccount,
  metaMaskWallet,
  portoWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { rainbowkitBurnerWallet } from "burner-connector";
import * as chains from "viem/chains";
import scaffoldConfig from "~~/scaffold.config";

const { onlyLocalBurnerWallet, targetNetworks } = scaffoldConfig;

const farcasterWallet = (() => ({
  id: "farcaster",
  name: "Farcaster Wallet",
  iconUrl: "https://farcaster.xyz/favicon.ico",
  iconBackground: "#6f3bf5",
  createConnector: () => miniAppConnector(),
})) as unknown as typeof walletConnectWallet;

// Wrap burner to align its types with the local RainbowKit/Wagmi versions
const burnerWallet = ((...args: any[]) =>
  (rainbowkitBurnerWallet as any)(...args)) as unknown as typeof walletConnectWallet;

const wallets = [
  farcasterWallet,
  portoWallet as unknown as typeof walletConnectWallet,
  metaMaskWallet,
  walletConnectWallet,
  baseAccount as unknown as typeof walletConnectWallet,
  rainbowWallet as unknown as typeof walletConnectWallet,
  ...(!targetNetworks.some(network => network.id !== (chains.hardhat as chains.Chain).id) || !onlyLocalBurnerWallet
    ? [burnerWallet]
    : []),
];

/**
 * wagmi connectors for the wagmi context
 */
export const wagmiConnectors = () => {
  return connectorsForWallets(
    [
      {
        groupName: "Supported Wallets",
        wallets,
      },
    ],

    {
      appName: "Ethereum Bazaar",
      projectId: scaffoldConfig.walletConnectProjectId,
    },
  );
};
