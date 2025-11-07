import { expect } from "chai";
import { ethers } from "hardhat";

describe("Marketplace + QuantityListings", function () {
  it("creates and buys unlimited quantity (ETH) with multi-qty", async function () {
    const [, buyer] = await ethers.getSigners();

    const Marketplace = await ethers.getContractFactory("Marketplace");
    const marketplace = await Marketplace.deploy();
    await marketplace.waitForDeployment();

    const QuantityListings = await ethers.getContractFactory("QuantityListings");
    const ql = await QuantityListings.deploy(await marketplace.getAddress());
    await ql.waitForDeployment();

    const data = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "uint256"],
      [ethers.ZeroAddress, ethers.parseEther("0.1"), 0], // unlimited
    );

    const tx = await marketplace.createListing(await ql.getAddress(), "ipfs://CID", data);
    const receipt = await tx.wait();
    const event = receipt!.logs.find(l => (l as any).fragment?.name === "ListingCreated") as any;
    const id = (event?.args?.id ?? 0n) as bigint;

    const qty = 3n;
    const buyHash = ethers.id("buy(uint256,address,bool,address,bytes)");
    const buySelector = ("0x" + buyHash.slice(2, 10)) as `0x${string}`;
    const buyAction = (buySelector + "0".repeat(64 - 8)) as `0x${string}`;
    const encodedQty = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [qty]);
    await expect(
      marketplace.connect(buyer).callAction(id, buyAction, encodedQty, { value: ethers.parseEther("0.3") }),
    ).to.emit(marketplace, "ListingAction");

    // Verify listing data still unlimited (remainingQuantity == 0)
    const res = await marketplace.getListing(id);
    const listingData: string = (res as any)[4];
    const [, , initialQty, remainingQty] = ethers.AbiCoder.defaultAbiCoder().decode(
      ["address", "uint256", "uint256", "uint256"],
      listingData,
    );
    expect(initialQty).to.equal(0n);
    expect(remainingQty).to.equal(0n);
  });

  it("decrements remaining and auto-closes when limited", async function () {
    const [, buyer] = await ethers.getSigners();

    const Marketplace = await ethers.getContractFactory("Marketplace");
    const marketplace = await Marketplace.deploy();
    await marketplace.waitForDeployment();

    const QuantityListings = await ethers.getContractFactory("QuantityListings");
    const ql = await QuantityListings.deploy(await marketplace.getAddress());
    await ql.waitForDeployment();

    // initialQuantity = 2
    const data = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "uint256"],
      [ethers.ZeroAddress, ethers.parseEther("1"), 2],
    );
    const tx = await marketplace.createListing(await ql.getAddress(), "ipfs://CID2", data);
    const receipt = await tx.wait();
    const event = receipt!.logs.find(l => (l as any).fragment?.name === "ListingCreated") as any;
    const id = (event?.args?.id ?? 0n) as bigint;

    const buyHash = ethers.id("buy(uint256,address,bool,address,bytes)");
    const buySelector = ("0x" + buyHash.slice(2, 10)) as `0x${string}`;
    const buyAction = (buySelector + "0".repeat(64 - 8)) as `0x${string}`;

    // Buy 1
    const one = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [1n]);
    await marketplace.connect(buyer).callAction(id, buyAction, one, { value: ethers.parseEther("1") });
    let res = await marketplace.getListing(id);
    let listingData: string = (res as any)[4];
    let decoded = ethers.AbiCoder.defaultAbiCoder().decode(["address", "uint256", "uint256", "uint256"], listingData);
    expect(decoded[2]).to.equal(2n); // initial
    expect(decoded[3]).to.equal(1n); // remaining
    // still active
    expect((res as any)[3]).to.equal(true);

    // Buy 1 again -> remaining 0, should close
    await marketplace.connect(buyer).callAction(id, buyAction, one, { value: ethers.parseEther("1") });
    res = await marketplace.getListing(id);
    listingData = (res as any)[4];
    decoded = ethers.AbiCoder.defaultAbiCoder().decode(["address", "uint256", "uint256", "uint256"], listingData);
    expect(decoded[3]).to.equal(0n);
    // inactive
    expect((res as any)[3]).to.equal(false);
  });
});
