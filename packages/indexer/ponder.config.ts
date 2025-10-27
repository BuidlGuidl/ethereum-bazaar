import { createConfig } from "ponder";
// Use deployed ABIs to avoid drift with contracts
import { easGetAttestationAbi } from "./abis/EASAbi";
import MarketplaceDeploymentBase from "../hardhat/deployments/base/Marketplace.json" assert { type: "json" };
import MarketplaceDeploymentHardhat from "../hardhat/deployments/localhost/Marketplace.json" assert { type: "json" };
import EASConfig from "./src/easConfig.json" assert { type: "json" };
import { Abi } from "viem";

const CHAIN_ID = Number(process.env.PONDER_CHAIN_ID ?? 8453);
const CHAIN_NAME = CHAIN_ID === 31337 ? "hardhat" : "base";
const EASConfigForChain = EASConfig[String(CHAIN_ID) as keyof typeof EASConfig];
const MarketplaceDeploymentForChain = CHAIN_ID === 31337 ? MarketplaceDeploymentHardhat : MarketplaceDeploymentBase;

// Parse RPC URLs - handle comma-separated list or single URL
const getRpcUrls = () => {
  const rpcEnvVar = process.env[`PONDER_RPC_URL_${process.env.PONDER_CHAIN_ID}`] ?? "https://base.llamarpc.com";
  const urls = rpcEnvVar.split(',').map(url => url.trim());
  return urls.length > 1 ? urls : rpcEnvVar;
};

export default createConfig({
  chains: {
    [CHAIN_NAME]: {
      id: Number(process.env.PONDER_CHAIN_ID ?? 8453),
      rpc: getRpcUrls(),
    },
  },
  contracts: {
    Marketplace: {
      chain: CHAIN_NAME,
      abi: MarketplaceDeploymentForChain.abi as Abi,
      address: MarketplaceDeploymentForChain.address as `0x${string}`,
      startBlock: MarketplaceDeploymentForChain.receipt.blockNumber,
    },
    // Index EAS core contract using the deployed ABI to match emitted events
    EAS: {
      chain: CHAIN_NAME,
      abi: easGetAttestationAbi,
      address: EASConfigForChain.eas as `0x${string}`,
      startBlock: MarketplaceDeploymentForChain.receipt.blockNumber,
    },
  },
});
