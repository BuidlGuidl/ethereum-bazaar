import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import schemaRegistryArtifact from "@ethereum-attestation-service/eas-contracts/artifacts/contracts/SchemaRegistry.sol/SchemaRegistry.json";
import easArtifact from "@ethereum-attestation-service/eas-contracts/artifacts/contracts/EAS.sol/EAS.json";

// Deploy EAS core contracts locally (SchemaRegistry and EAS) using artifacts from the npm package
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // Load artifacts from installed package (json imports)
  if (hre.network.name != "localhost") {
    return;
  }

  const schemaRegistry = await deploy("SchemaRegistry", {
    from: deployer,
    log: true,
    autoMine: true,
    args: [],
    contract: {
      abi: schemaRegistryArtifact.abi,
      bytecode: schemaRegistryArtifact.bytecode,
    },
  });

  await deploy("EAS", {
    from: deployer,
    log: true,
    autoMine: true,
    args: [schemaRegistry.address],
    contract: {
      abi: easArtifact.abi,
      bytecode: easArtifact.bytecode,
    },
  });
};

export default func;
func.tags = ["EASLocal", "ReviewSchema"];
