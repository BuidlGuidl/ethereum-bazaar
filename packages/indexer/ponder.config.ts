import { createConfig } from "ponder";
// Use deployed ABIs to avoid drift with contracts
import { easGetAttestationAbi } from "./abis/EASAbi";
import easDeployment from "../hardhat/deployments/localhost/EAS.json" assert { type: "json" };
import MarketplaceDeployment from "../hardhat/deployments/localhost/Marketplace.json" assert { type: "json" };

export default createConfig({
  chains: {
    localhost: {
      id: 31337,
      rpc: process.env.PONDER_RPC_URL_31337 ?? "http://127.0.0.1:8545",
    },
  },
  contracts: {
    Marketplace: {
      chain: "localhost",
      // Cast ABI to const to preserve literal event names for type inference
      abi: MarketplaceDeployment.abi as const,
      address: MarketplaceDeployment.address as `0x${string}`,
      startBlock: 0,
    },
    // Index EAS core contract using the deployed ABI to match emitted events
    EAS: {
      chain: "localhost",
      abi: easGetAttestationAbi,
      address: easDeployment.address as `0x${string}`,
      startBlock: 0,
    },
  },
});
