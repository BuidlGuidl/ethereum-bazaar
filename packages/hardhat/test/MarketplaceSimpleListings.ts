import { expect } from "chai";
import { ethers } from "hardhat";

describe("Marketplace + SimpleListings", function () {
  it("creates and buys a simple listing (ETH)", async function () {
    const [, buyer] = await ethers.getSigners();

    const Marketplace = await ethers.getContractFactory("Marketplace");
    const marketplace = await Marketplace.deploy();
    await marketplace.waitForDeployment();

    const SimpleListings = await ethers.getContractFactory("SimpleListings");
    const simpleListings = await SimpleListings.deploy(await marketplace.getAddress());
    await simpleListings.waitForDeployment();

    const data = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "string"],
      [ethers.ZeroAddress, ethers.parseEther("1"), "ipfs://CID"],
    );

    const tx = await marketplace.createListing(await simpleListings.getAddress(), data);
    const receipt = await tx.wait();
    const event = receipt!.logs.find(l => (l as any).fragment?.name === "ListingCreated") as any;
    const id = event?.args?.id ?? 1n;

    await expect(marketplace.connect(buyer).buyListing(id, "0x", { value: ethers.parseEther("1") })).to.emit(
      marketplace,
      "ListingSold",
    );
  });
});
