"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { encodeAbiParameters, parseEther, zeroAddress } from "viem";
import { IPFSUploader } from "~~/components/marketplace/IPFSUploader";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";
import { uploadJSON } from "~~/services/ipfs/upload";

const NewListingPage = () => {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("ETH");
  const [contact, setContact] = useState("");
  const [locationId, setLocationId] = useState("");
  // const [locationName, setLocationName] = useState<string>("");
  // Location is derived from user's previously selected location (localStorage)
  const [submitting, setSubmitting] = useState(false);
  const [imageCid, setImageCid] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  const { writeContractAsync: writeMarketplace } = useScaffoldWriteContract({ contractName: "Marketplace" });
  const { data: simpleListings } = useDeployedContractInfo({ contractName: "SimpleListings" });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (!locationId) {
        setSubmitting(false);
        return;
      }
      // If a file is selected but not uploaded yet, upload it now
      if (!imageCid && selectedImage) {
        try {
          // Lazy-import to avoid circulars when rendering server
          const { uploadFile } = await import("~~/services/ipfs/upload");
          const uploaded = await uploadFile(selectedImage);
          setImageCid(uploaded);
          // Use local variable to avoid race with state update
          const localImageCid = uploaded;
          const metadata = {
            title,
            description,
            category,
            price,
            currency,
            contact,
            image: localImageCid,
            locationId,
          };
          const cid = await uploadJSON(metadata);

          const paymentToken: `0x${string}` =
            currency === "ETH" ? zeroAddress : (process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`);
          const priceWei = parseEther(price || "0");

          const encoded = encodeAbiParameters(
            [
              { name: "paymentToken", type: "address" },
              { name: "price", type: "uint256" },
              { name: "ipfsHash", type: "string" },
            ],
            [paymentToken, priceWei, cid],
          );

          await writeMarketplace({
            functionName: "createListing",
            args: [simpleListings?.address as `0x${string}`, encoded],
          });
          router.push("/");
          return;
        } catch {}
      }

      const metadata = {
        title,
        description,
        category,
        price,
        currency,
        contact,
        image: imageCid || null,
        locationId,
      };
      const cid = await uploadJSON(metadata);

      const paymentToken: `0x${string}` =
        currency === "ETH" ? zeroAddress : (process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`);
      const priceWei = parseEther(price || "0");

      // use viem to encode the data
      const encoded = encodeAbiParameters(
        [
          { name: "paymentToken", type: "address" },
          { name: "price", type: "uint256" },
          { name: "ipfsHash", type: "string" },
        ],
        [paymentToken, priceWei, cid],
      );

      await writeMarketplace({
        functionName: "createListing",
        args: [simpleListings?.address as `0x${string}`, encoded],
      });
      router.push("/");
    } finally {
      setSubmitting(false);
    }
  };

  // Initialize selected location from recent localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("marketplace.locations");
      if (stored) {
        const arr: string[] = JSON.parse(stored);
        if (arr[0]) setLocationId(arr[0]);
      }
    } catch {}
  }, []);

  // No location picker UI on this page; we rely on the selected location from storage

  return (
    <form className="p-4 space-y-3" onSubmit={onSubmit}>
      <h1 className="text-2xl font-semibold">Create Listing</h1>
      <input
        className="input input-bordered w-full"
        placeholder="Title"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />
      <textarea
        className="textarea textarea-bordered w-full"
        placeholder="Description"
        value={description}
        onChange={e => setDescription(e.target.value)}
      />
      <input
        className="input input-bordered w-full"
        placeholder="Category"
        value={category}
        onChange={e => setCategory(e.target.value)}
      />
      <div className="flex gap-2">
        <input
          className="input input-bordered flex-1"
          placeholder="Price"
          value={price}
          onChange={e => setPrice(e.target.value)}
        />
        <select className="select select-bordered" value={currency} onChange={e => setCurrency(e.target.value)}>
          <option>ETH</option>
          <option>USDC</option>
        </select>
      </div>
      <input
        className="input input-bordered w-full"
        placeholder="Contact (Warpcast link, email, etc.)"
        value={contact}
        onChange={e => setContact(e.target.value)}
      />
      <IPFSUploader onUploaded={setImageCid} onSelected={setSelectedImage} />
      <button className="btn btn-primary w-full" disabled={!locationId || submitting}>
        {submitting ? "Creating..." : "Create"}
      </button>
    </form>
  );
};

export default NewListingPage;
