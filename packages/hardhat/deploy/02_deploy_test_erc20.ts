import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // Only deploy on localhost/hardhat for development convenience
  const networkName = hre.network.name;
  if (networkName !== "localhost" && networkName !== "hardhat") {
    console.log("Skipping TestERC20 deploy on network:", networkName);
    return;
  }

  const OWNER = "0xe1CE8616c669Cd3F1EC4598cef01B89331e7D849";
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, get, log } = hre.deployments;

  // Token A: 2 decimals
  const name2 = process.env.TEST_ERC20_2_NAME ?? "Test Token 2d";
  const symbol2 = process.env.TEST_ERC20_2_SYMBOL ?? "TT2";
  const decimals2 = 2;

  await deploy("TestERC20_2dec", {
    contract: "TestERC20",
    from: deployer,
    args: [name2, symbol2, decimals2, OWNER],
    log: true,
    autoMine: true,
  });

  const token2 = await get("TestERC20_2dec");
  log(`TestERC20_2dec deployed at ${token2.address} (name=${name2}, symbol=${symbol2}, decimals=${decimals2})`);

  // Token B: 6 decimals
  const name6 = process.env.TEST_ERC20_6_NAME ?? "Test Token 6d";
  const symbol6 = process.env.TEST_ERC20_6_SYMBOL ?? "TT6";
  const decimals6 = 6;

  await deploy("TestERC20_6dec", {
    contract: "TestERC20",
    from: deployer,
    args: [name6, symbol6, decimals6, OWNER],
    log: true,
    autoMine: true,
  });

  const token6 = await get("TestERC20_6dec");
  log(`TestERC20_6dec deployed at ${token6.address} (name=${name6}, symbol=${symbol6}, decimals=${decimals6})`);
};

export default func;
func.tags = ["TestERC20"];
