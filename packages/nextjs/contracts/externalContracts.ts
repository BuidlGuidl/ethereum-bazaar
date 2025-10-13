/**
 * Builds a cross-network declaration of external contracts (EAS) by
 * sourcing addresses from a single config (`EAS_CONFIGS`).
 * This avoids duplication with `easConfig.json` and `utils/eas.ts`.
 */
import { EAS_CONFIGS } from "~~/utils/eas";
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

const EAS_MINIMAL_ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: "bytes32", name: "schema", type: "bytes32" },
          {
            components: [
              { internalType: "address", name: "recipient", type: "address" },
              { internalType: "uint64", name: "expirationTime", type: "uint64" },
              { internalType: "bool", name: "revocable", type: "bool" },
              { internalType: "bytes32", name: "refUID", type: "bytes32" },
              { internalType: "bytes", name: "data", type: "bytes" },
              { internalType: "uint256", name: "value", type: "uint256" },
            ],
            internalType: "struct AttestationRequestData",
            name: "data",
            type: "tuple",
          },
        ],
        internalType: "struct AttestationRequest",
        name: "request",
        type: "tuple",
      },
    ],
    name: "attest",
    outputs: [{ internalType: "bytes32", name: "uid", type: "bytes32" }],
    stateMutability: "payable",
    type: "function",
  },
] as const;

const buildExternalContracts = (): GenericContractsDeclaration => {
  const result: Record<number, any> = {};
  for (const [chainIdStr, cfg] of Object.entries(EAS_CONFIGS)) {
    const chainId = Number(chainIdStr);
    if (!cfg?.easAddress) continue;
    result[chainId] = {
      EAS: {
        address: cfg.easAddress as `0x${string}`,
        abi: EAS_MINIMAL_ABI,
      },
    };
  }
  return result as GenericContractsDeclaration;
};

const externalContracts = buildExternalContracts();

export default externalContracts as GenericContractsDeclaration;
