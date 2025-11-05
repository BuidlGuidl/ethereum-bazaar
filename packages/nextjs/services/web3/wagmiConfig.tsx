import { wagmiConnectors } from "./wagmiConnectors";
import { createConfig } from "@privy-io/wagmi";
import { Chain, createClient, fallback, http } from "viem";
import { hardhat, mainnet } from "viem/chains";
import scaffoldConfig, { DEFAULT_ALCHEMY_API_KEY, ScaffoldConfig } from "~~/scaffold.config";
import { getAlchemyHttpUrl } from "~~/utils/scaffold-eth";

const { targetNetworks } = scaffoldConfig;

// We always want to have mainnet enabled (ENS resolution, ETH price, etc). But only once.
const hasMainnet = targetNetworks.find((network: Chain) => network.id === 1);
const enabledChainsArray = hasMainnet ? targetNetworks : [...targetNetworks, mainnet];
export const enabledChains = enabledChainsArray as unknown as readonly [Chain, ...Chain[]];

export const wagmiConfig = createConfig({
  chains: enabledChains,
  connectors: [...wagmiConnectors()],
  ssr: true,
  client: ({ chain }) => {
    let rpcFallbacks = [http()];
    const rpcOverrideUrl = (scaffoldConfig.rpcOverrides as ScaffoldConfig["rpcOverrides"])?.[chain.id];
    if (rpcOverrideUrl) {
      rpcFallbacks = [http(rpcOverrideUrl), http()];
    } else {
      const alchemyHttpUrl = getAlchemyHttpUrl(chain.id);
      if (alchemyHttpUrl) {
        const isUsingDefaultKey = scaffoldConfig.alchemyApiKey === DEFAULT_ALCHEMY_API_KEY;
        rpcFallbacks = isUsingDefaultKey ? [http(), http(alchemyHttpUrl)] : [http(alchemyHttpUrl), http()];
      }
    }
    return createClient({
      chain,
      transport: fallback(rpcFallbacks),
      ...(chain.id !== (hardhat as Chain).id ? { pollingInterval: scaffoldConfig.pollingInterval } : {}),
    });
  },
});
