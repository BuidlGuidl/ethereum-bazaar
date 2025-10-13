import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import * as fs from "fs";
import * as path from "path";
import schemaRegArtifact from "@ethereum-attestation-service/eas-contracts/artifacts/contracts/SchemaRegistry.sol/SchemaRegistry.json";

// Registers a local review schema on the deployed SchemaRegistry and logs the schema UID
// Schema: uint8 rating,string comment
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  const chainId = await hre.getChainId();
  const KNOWN_SCHEMA_REGISTRY: Record<string, string> = {
    // Mainnets
    "1": "0xA7b39296258348C78294F95B872b282326A97BDF", // Ethereum mainnet
    "10": "0x4200000000000000000000000000000000000020", // Optimism
    "8453": "0x4200000000000000000000000000000000000020", // Base
    "42161": "0xA310da9c5B885E7fb3fbA9D66E9Ba6Df512b78eB", // Arbitrum One
    // Testnets
    "11155111": "0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0", // Sepolia
    "11155420": "0x4200000000000000000000000000000000000020", // Optimism Sepolia
    "84532": "0x4200000000000000000000000000000000000020", // Base Sepolia
    "420": "0x4200000000000000000000000000000000000020", // Optimism Goerli
  };

  const KNOWN_EAS: Record<string, string> = {
    // Mainnets
    "1": "0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587", // Ethereum mainnet
    "10": "0x4200000000000000000000000000000000000021", // Optimism
    "8453": "0x4200000000000000000000000000000000000021", // Base
    "42161": "0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458", // Arbitrum One
    // Testnets
    "11155111": "0xC2679fBD37d54388Ce493F1DB75320D236e1815e", // Sepolia
    "11155420": "0x4200000000000000000000000000000000000021", // Optimism Sepolia
    "84532": "0x4200000000000000000000000000000000000021", // Base Sepolia
    "420": "0x4200000000000000000000000000000000000021", // Optimism Goerli
  };

  let schemaRegistryAddress: string;
  if (hre.network.name === "localhost") {
    schemaRegistryAddress = (await hre.deployments.get("SchemaRegistry")).address;
  } else if (KNOWN_SCHEMA_REGISTRY[chainId]) {
    schemaRegistryAddress = KNOWN_SCHEMA_REGISTRY[chainId];
  } else {
    throw new Error(`SchemaRegistry address unknown for chainId ${chainId}. Add it to KNOWN_SCHEMA_REGISTRY.`);
  }

  const signer = await hre.ethers.getSigner(deployer);
  const schemaRegistry = new hre.ethers.Contract(schemaRegistryAddress, schemaRegArtifact.abi, signer);

  // New schema links reviews to a specific sale via listingId and counterparty
  // Recipient of the attestation is the reviewee address
  const schema = "uint256 listingId,uint8 rating,string commentIPFSHash";
  const revocable = true;
  const resolver = hre.ethers.ZeroAddress;

  let uid: string | undefined;
  try {
    const tx = await (schemaRegistry as any).register(schema, resolver, revocable);
    const receipt = await tx.wait();
    console.log("🧾 Review schema registered. TX:", receipt?.hash);
    // Parse Registered event to get UID
    const iface = new hre.ethers.Interface(schemaRegArtifact.abi);
    for (const log of receipt?.logs || []) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === "Registered") {
          uid = parsed.args?.uid as string;
          break;
        }
      } catch {}
    }
  } catch {
    console.log("ℹ️  Schema likely already registered; computing UID.");
  }
  if (!uid) {
    // Compute with encodePacked to mirror contract logic
    const packed = hre.ethers.solidityPacked(["string", "address", "bool"], [schema, resolver, revocable]);
    uid = hre.ethers.keccak256(packed);
  }
  console.log("🆔 Review schema UID:", uid);

  // Determine EAS address for output helper file
  let easAddressOut = "";
  if (hre.network.name === "localhost") {
    easAddressOut = (await hre.deployments.get("EAS")).address;
  } else if (KNOWN_EAS[chainId]) {
    easAddressOut = KNOWN_EAS[chainId];
  }

  // Always write a generic helper json for frontend/backends regardless of network
  const nextjsOutPath = path.resolve(hre.config.paths.root, "../nextjs/contracts/easConfig.json");
  const nextjsOut = {
    chainId: await hre.getChainId(),
    schemaRegistry: schemaRegistryAddress,
    eas: easAddressOut,
    reviewSchemaUid: uid,
  };
  fs.writeFileSync(nextjsOutPath, JSON.stringify(nextjsOut, null, 2), { encoding: "utf-8" });

  const indexerOutPath = path.resolve(hre.config.paths.root, "../indexer/src/easConfig.json");
  const indexerOut = {
    chainId: await hre.getChainId(),
    schemaRegistry: schemaRegistryAddress,
    eas: easAddressOut,
    reviewSchemaUid: uid,
  };
  fs.writeFileSync(indexerOutPath, JSON.stringify(indexerOut, null, 2), { encoding: "utf-8" });
  console.log("📝 Wrote EAS generic config:", nextjsOutPath, indexerOutPath);
};

export default func;
func.tags = ["EASLocal", "ReviewSchema"];
