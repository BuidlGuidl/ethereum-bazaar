import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, get } = hre.deployments;

  const marketplace = await get("Marketplace");

  await deploy("QuantityListings", {
    from: deployer,
    args: [marketplace.address],
    log: true,
    autoMine: true,
  });

  console.log("QuantityListings:", (await get("QuantityListings")).address);
};

export default func;
func.tags = ["QuantityListings"];
func.dependencies = ["Marketplace"];
