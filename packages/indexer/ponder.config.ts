import { createConfig } from "ponder";
import { MarketplaceAbi } from "./abis/MarketplaceAbi";
import { SimpleListingsAbi } from "./abis/SimpleListingsAbi";
import { easGetAttestationAbi } from "./abis/EASAbi";
import easDeployment from "../hardhat/deployments/localhost/EAS.json" assert { type: "json" };
import MarketplaceDeployment from "../hardhat/deployments/localhost/Marketplace.json" assert { type: "json" };
import SimpleListingsDeployment from "../hardhat/deployments/localhost/SimpleListings.json" assert { type: "json" };

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
      abi: MarketplaceAbi,
      address: MarketplaceDeployment.address as `0x${string}`,
      startBlock: 0,
    },
    SimpleListings: {
      chain: "localhost",
      abi: SimpleListingsAbi,
      address: SimpleListingsDeployment.address as `0x${string}`,
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
