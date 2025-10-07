"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Hex, decodeAbiParameters } from "viem";
import { PayButton } from "~~/components/marketplace/PayButton";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth/useDeployedContractInfo";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth/useScaffoldReadContract";
import { fetchJsonFromCid } from "~~/services/ipfs/fetch";

const ListingDetailsPage = () => {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<any | null>(null);
  const idNum = useMemo(() => (params?.id ? BigInt(params.id) : undefined), [params?.id]);

  const { data: ptr } = useScaffoldReadContract({
    contractName: "Marketplace",
    functionName: "getListing",
    args: [idNum],
  });
  const { data: simpleListingsInfo } = useDeployedContractInfo("SimpleListings");

  // decoder registry keyed by listing type contract address
  const decoders = useMemo(() => {
    const map = new Map<string, (data: Hex) => any>();
    if (simpleListingsInfo?.address) {
      map.set(simpleListingsInfo.address.toLowerCase(), (bytes: Hex) => {
        const [creator, paymentToken, price, ipfsHash, active] = decodeAbiParameters(
          [{ type: "address" }, { type: "address" }, { type: "uint256" }, { type: "string" }, { type: "bool" }],
          bytes,
        );
        return { creator, paymentToken, price, ipfsHash, active };
      });
    }
    return map;
  }, [simpleListingsInfo?.address]);

  const pointer = useMemo(() => (ptr ? (ptr as any)[0] : undefined), [ptr]);
  const listingTypeDataBytes = useMemo(() => (ptr ? (ptr as any)[1] : undefined), [ptr]);

  useEffect(() => {
    if (!pointer || !listingTypeDataBytes) return;
    const lt = (pointer.listingType as string | undefined)?.toLowerCase?.();
    const decoder = lt ? decoders.get(lt) : undefined;
    const doWork = async () => {
      let decoded: any | undefined;
      try {
        decoded = decoder ? decoder(listingTypeDataBytes as Hex) : undefined;
      } catch {
        // ignore
      }
      let metadata: any | undefined;
      const maybeIpfs = decoded?.ipfsHash || decoded?.metadata || undefined;
      if (maybeIpfs && typeof maybeIpfs === "string") {
        try {
          metadata = await fetchJsonFromCid(maybeIpfs);
        } catch {
          // ignore metadata fetch failure
        }
      }
      setData({ pointer, decoded, metadata, raw: !decoded ? listingTypeDataBytes : undefined });
    };
    void doWork();
  }, [pointer, listingTypeDataBytes, decoders]);
  useEffect(() => {
    setData(null);
  }, [params?.id]);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Listing {params?.id}</h1>
      {!data ? (
        <p className="opacity-70">Loading...</p>
      ) : (
        <pre className="text-xs bg-base-200 p-3 rounded-xl">{JSON.stringify(data, null, 2)}</pre>
      )}
      <div className="flex gap-2">
        <button className="btn btn-secondary">Contact Seller</button>
        {pointer?.creator ? <PayButton to={pointer.creator as `0x${string}`} valueEth="0" /> : null}
        <button className="btn">Leave Review</button>
      </div>
    </div>
  );
};

export default ListingDetailsPage;
