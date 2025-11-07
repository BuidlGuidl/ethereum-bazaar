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

    // data = abi.encode(address paymentToken, uint256 price)
    const data = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256"],
      [ethers.ZeroAddress, ethers.parseEther("1")],
    );

    const tx = await marketplace.createListing(await simpleListings.getAddress(), "ipfs://CID", data);
    const receipt = await tx.wait();
    const event = receipt!.logs.find(l => (l as any).fragment?.name === "ListingCreated") as any;
    const id = event?.args?.id ?? 1n;

    const hash = ethers.id("buy(uint256,address,bool,address,bytes)");
    const selector = ("0x" + hash.slice(2, 10)) as `0x${string}`; // 4-byte
    // Right-pad selector to bytes32 (4 bytes + 28 zero bytes)
    const action = (selector + "0".repeat(64 - 8)) as `0x${string}`;

    await expect(marketplace.connect(buyer).callAction(id, action, "0x", { value: ethers.parseEther("1") })).to.emit(
      marketplace,
      "ListingAction",
    );
  });
});
