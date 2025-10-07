import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, get } = hre.deployments;

  await deploy("Marketplace", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  // Optional: log addresses for convenience
  const marketplaceAddress = (await get("Marketplace")).address;
  console.log("Marketplace:", marketplaceAddress);
};

export default func;
func.tags = ["Marketplace"]; // yarn deploy --tags Marketplace
// No dependency; Marketplace deploys first
