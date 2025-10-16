import { createConfig } from "ponder";
// Use deployed ABIs to avoid drift with contracts
import { easGetAttestationAbi } from "./abis/EASAbi";
import MarketplaceDeployment from "../hardhat/deployments/base/Marketplace.json" assert { type: "json" };
import EASConfig from "./src/easConfig.json" assert { type: "json" };
import { Abi } from "viem";

export default createConfig({
  chains: {
    base: {
      id: 8453,
      rpc: process.env.PONDER_RPC_URL_8453 ?? "https://base.llamarpc.com",
    },
  },
  contracts: {
    Marketplace: {
      chain: "base",
      abi: MarketplaceDeployment.abi as Abi,
      address: MarketplaceDeployment.address as `0x${string}`,
      startBlock: MarketplaceDeployment.receipt.blockNumber,
    },
    // Index EAS core contract using the deployed ABI to match emitted events
    EAS: {
      chain: "base",
      abi: easGetAttestationAbi,
      address: EASConfig["8453"].eas as `0x${string}`,
      startBlock: MarketplaceDeployment.receipt.blockNumber,
    },
  },
});
