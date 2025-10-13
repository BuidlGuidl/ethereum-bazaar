import { Chain } from "viem/chains";
import { arbitrum, base, baseSepolia, hardhat, mainnet, optimism, optimismSepolia, sepolia } from "viem/chains";
import easConfig from "~~/contracts/easConfig.json";

export type EasNetworkConfig = {
  chain: Chain;
  easAddress: string;
  graphqlUrl: string;
  reviewSchemaUid: string; // EAS schema UID for reviews
  schemaRegistryAddress?: string;
};

// Default known deployments; can be overridden via env vars
const DEFAULTS = {
  [sepolia.id]: {
    easAddress: "0xC2679fBD37d54388Ce493F1DB75320D236e1815e",
    schemaRegistryAddress: "0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0",
    graphqlUrl: "https://sepolia.easscan.org/graphql",
  },
  [mainnet.id]: {
    easAddress: "0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587",
    schemaRegistryAddress: "0xA7b39296258348C78294F95B872b282326A97BDF",
    graphqlUrl: "https://easscan.org/graphql",
  },
  [optimism.id]: {
    easAddress: "0x4200000000000000000000000000000000000021",
    schemaRegistryAddress: "0x4200000000000000000000000000000000000020",
    graphqlUrl: "https://optimism.easscan.org/graphql",
  },
  [base.id]: {
    easAddress: "0x4200000000000000000000000000000000000021",
    schemaRegistryAddress: "0x4200000000000000000000000000000000000020",
    graphqlUrl: "https://base.easscan.org/graphql",
  },
  [arbitrum.id]: {
    easAddress: "0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458",
    schemaRegistryAddress: "0xA310da9c5B885E7fb3fbA9D66E9Ba6Df512b78eB",
    graphqlUrl: "https://arbitrum.easscan.org/graphql",
  },
  [optimismSepolia.id]: {
    easAddress: "0x4200000000000000000000000000000000000021",
    schemaRegistryAddress: "0x4200000000000000000000000000000000000020",
    graphqlUrl: "https://optimism-sepolia.easscan.org/graphql",
  },
  [baseSepolia.id]: {
    easAddress: "0x4200000000000000000000000000000000000021",
    schemaRegistryAddress: "0x4200000000000000000000000000000000000020",
    graphqlUrl: "https://base-sepolia.easscan.org/graphql",
  },
} as const;

export const EAS_CONFIGS: Record<number, EasNetworkConfig> = {
  [hardhat.id]: {
    chain: hardhat,
    easAddress: (easConfig as any)?.eas || process.env.NEXT_PUBLIC_EAS_ADDRESS_LOCALHOST || "",
    graphqlUrl: process.env.NEXT_PUBLIC_EAS_GRAPHQL_LOCALHOST || "",
    reviewSchemaUid: (easConfig as any)?.reviewSchemaUid || process.env.NEXT_PUBLIC_EAS_REVIEW_SCHEMA_LOCALHOST || "",
    schemaRegistryAddress:
      (easConfig as any)?.schemaRegistry || process.env.NEXT_PUBLIC_EAS_SCHEMA_REGISTRY_LOCALHOST || "",
  },
  // For all other networks, prefer values from easConfig.json when the chainId matches that network
  [sepolia.id]: (() => {
    const fileChainId = Number((easConfig as any)?.chainId);
    const useFile = fileChainId === sepolia.id;
    return {
      chain: sepolia,
      easAddress:
        (useFile && (easConfig as any)?.eas) ||
        process.env.NEXT_PUBLIC_EAS_ADDRESS_SEPOLIA ||
        DEFAULTS[sepolia.id].easAddress,
      graphqlUrl: process.env.NEXT_PUBLIC_EAS_GRAPHQL_SEPOLIA || DEFAULTS[sepolia.id].graphqlUrl,
      reviewSchemaUid:
        (useFile && (easConfig as any)?.reviewSchemaUid) || process.env.NEXT_PUBLIC_EAS_REVIEW_SCHEMA_SEPOLIA || "",
      schemaRegistryAddress:
        (useFile && (easConfig as any)?.schemaRegistry) ||
        process.env.NEXT_PUBLIC_EAS_SCHEMA_REGISTRY_SEPOLIA ||
        DEFAULTS[sepolia.id].schemaRegistryAddress,
    } as EasNetworkConfig;
  })(),
  [mainnet.id]: (() => {
    const fileChainId = Number((easConfig as any)?.chainId);
    const useFile = fileChainId === mainnet.id;
    return {
      chain: mainnet,
      easAddress:
        (useFile && (easConfig as any)?.eas) ||
        process.env.NEXT_PUBLIC_EAS_ADDRESS_MAINNET ||
        DEFAULTS[mainnet.id].easAddress,
      graphqlUrl: process.env.NEXT_PUBLIC_EAS_GRAPHQL_MAINNET || DEFAULTS[mainnet.id].graphqlUrl,
      reviewSchemaUid:
        (useFile && (easConfig as any)?.reviewSchemaUid) || process.env.NEXT_PUBLIC_EAS_REVIEW_SCHEMA_MAINNET || "",
      schemaRegistryAddress:
        (useFile && (easConfig as any)?.schemaRegistry) ||
        process.env.NEXT_PUBLIC_EAS_SCHEMA_REGISTRY_MAINNET ||
        DEFAULTS[mainnet.id].schemaRegistryAddress,
    } as EasNetworkConfig;
  })(),
  [optimism.id]: (() => {
    const fileChainId = Number((easConfig as any)?.chainId);
    const useFile = fileChainId === optimism.id;
    return {
      chain: optimism,
      easAddress:
        (useFile && (easConfig as any)?.eas) ||
        process.env.NEXT_PUBLIC_EAS_ADDRESS_OPTIMISM ||
        DEFAULTS[optimism.id].easAddress,
      graphqlUrl: process.env.NEXT_PUBLIC_EAS_GRAPHQL_OPTIMISM || DEFAULTS[optimism.id].graphqlUrl,
      reviewSchemaUid:
        (useFile && (easConfig as any)?.reviewSchemaUid) || process.env.NEXT_PUBLIC_EAS_REVIEW_SCHEMA_OPTIMISM || "",
      schemaRegistryAddress:
        (useFile && (easConfig as any)?.schemaRegistry) ||
        process.env.NEXT_PUBLIC_EAS_SCHEMA_REGISTRY_OPTIMISM ||
        DEFAULTS[optimism.id].schemaRegistryAddress,
    } as EasNetworkConfig;
  })(),
  [base.id]: (() => {
    const fileChainId = Number((easConfig as any)?.chainId);
    const useFile = fileChainId === base.id;
    return {
      chain: base,
      easAddress:
        (useFile && (easConfig as any)?.eas) ||
        process.env.NEXT_PUBLIC_EAS_ADDRESS_BASE ||
        DEFAULTS[base.id].easAddress,
      graphqlUrl: process.env.NEXT_PUBLIC_EAS_GRAPHQL_BASE || DEFAULTS[base.id].graphqlUrl,
      reviewSchemaUid:
        (useFile && (easConfig as any)?.reviewSchemaUid) || process.env.NEXT_PUBLIC_EAS_REVIEW_SCHEMA_BASE || "",
      schemaRegistryAddress:
        (useFile && (easConfig as any)?.schemaRegistry) ||
        process.env.NEXT_PUBLIC_EAS_SCHEMA_REGISTRY_BASE ||
        DEFAULTS[base.id].schemaRegistryAddress,
    } as EasNetworkConfig;
  })(),
  [arbitrum.id]: (() => {
    const fileChainId = Number((easConfig as any)?.chainId);
    const useFile = fileChainId === arbitrum.id;
    return {
      chain: arbitrum,
      easAddress:
        (useFile && (easConfig as any)?.eas) ||
        process.env.NEXT_PUBLIC_EAS_ADDRESS_ARBITRUM ||
        DEFAULTS[arbitrum.id].easAddress,
      graphqlUrl: process.env.NEXT_PUBLIC_EAS_GRAPHQL_ARBITRUM || DEFAULTS[arbitrum.id].graphqlUrl,
      reviewSchemaUid:
        (useFile && (easConfig as any)?.reviewSchemaUid) || process.env.NEXT_PUBLIC_EAS_REVIEW_SCHEMA_ARBITRUM || "",
      schemaRegistryAddress:
        (useFile && (easConfig as any)?.schemaRegistry) ||
        process.env.NEXT_PUBLIC_EAS_SCHEMA_REGISTRY_ARBITRUM ||
        DEFAULTS[arbitrum.id].schemaRegistryAddress,
    } as EasNetworkConfig;
  })(),
  [optimismSepolia.id]: (() => {
    const fileChainId = Number((easConfig as any)?.chainId);
    const useFile = fileChainId === optimismSepolia.id;
    return {
      chain: optimismSepolia,
      easAddress:
        (useFile && (easConfig as any)?.eas) ||
        process.env.NEXT_PUBLIC_EAS_ADDRESS_OPTIMISM_SEPOLIA ||
        DEFAULTS[optimismSepolia.id].easAddress,
      graphqlUrl: process.env.NEXT_PUBLIC_EAS_GRAPHQL_OPTIMISM_SEPOLIA || DEFAULTS[optimismSepolia.id].graphqlUrl,
      reviewSchemaUid:
        (useFile && (easConfig as any)?.reviewSchemaUid) ||
        process.env.NEXT_PUBLIC_EAS_REVIEW_SCHEMA_OPTIMISM_SEPOLIA ||
        "",
      schemaRegistryAddress:
        (useFile && (easConfig as any)?.schemaRegistry) ||
        process.env.NEXT_PUBLIC_EAS_SCHEMA_REGISTRY_OPTIMISM_SEPOLIA ||
        DEFAULTS[optimismSepolia.id].schemaRegistryAddress,
    } as EasNetworkConfig;
  })(),
  [baseSepolia.id]: (() => {
    const fileChainId = Number((easConfig as any)?.chainId);
    const useFile = fileChainId === baseSepolia.id;
    return {
      chain: baseSepolia,
      easAddress:
        (useFile && (easConfig as any)?.eas) ||
        process.env.NEXT_PUBLIC_EAS_ADDRESS_BASE_SEPOLIA ||
        DEFAULTS[baseSepolia.id].easAddress,
      graphqlUrl: process.env.NEXT_PUBLIC_EAS_GRAPHQL_BASE_SEPOLIA || DEFAULTS[baseSepolia.id].graphqlUrl,
      reviewSchemaUid:
        (useFile && (easConfig as any)?.reviewSchemaUid) ||
        process.env.NEXT_PUBLIC_EAS_REVIEW_SCHEMA_BASE_SEPOLIA ||
        "",
      schemaRegistryAddress:
        (useFile && (easConfig as any)?.schemaRegistry) ||
        process.env.NEXT_PUBLIC_EAS_SCHEMA_REGISTRY_BASE_SEPOLIA ||
        DEFAULTS[baseSepolia.id].schemaRegistryAddress,
    } as EasNetworkConfig;
  })(),
};

export const getEasConfig = (chainId?: number) => {
  if (!chainId) return undefined;
  return EAS_CONFIGS[chainId];
};

// Minimal ABI for the EAS Attested event
export const EAS_ATTESTED_EVENT_ABI = [
  {
    type: "event",
    name: "Attested",
    inputs: [
      { name: "recipient", type: "address", indexed: true },
      { name: "attester", type: "address", indexed: true },
      { name: "uid", type: "bytes32", indexed: true },
      { name: "schema", type: "bytes32", indexed: false },
      { name: "time", type: "uint64", indexed: false },
      { name: "expirationTime", type: "uint64", indexed: false },
      { name: "revocationTime", type: "uint64", indexed: false },
      { name: "refUID", type: "bytes32", indexed: false },
      { name: "data", type: "bytes", indexed: false },
    ],
  },
] as const;

export type ReviewAttestation = {
  id: string;
  attester: string;
  recipient: string;
  timeCreated: number;
  data: string;
  decodedDataJson?: string | null;
};
