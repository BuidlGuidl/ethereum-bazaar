"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zeroAddress } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth/useScaffoldReadContract";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";

export interface PayButtonProps {
  listingId: string | number;
  priceWei?: string; // pass as string to avoid bigint serialization issues
  paymentToken?: string; // zero address for ETH; otherwise ERC20
  disabled?: boolean;
}

export const PayButton = ({ listingId, priceWei, paymentToken, disabled }: PayButtonProps) => {
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "Marketplace" });
  const { address } = useAccount();
  const router = useRouter();
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const publicClient = usePublicClient();

  const isEth = useMemo(() => {
    const pt = (paymentToken || "").toLowerCase();
    return !pt || pt === zeroAddress.toLowerCase();
  }, [paymentToken]);

  const label = useMemo(() => {
    if (isEth && priceWei) {
      // Display value in ETH with simple formatting handled by parent; fallback to generic label
      return "Buy";
    }
    return "Buy";
  }, [isEth, priceWei]);

  // Read listing pointer to get listingType (spender) address
  const idBig = useMemo(() => BigInt(typeof listingId === "number" ? listingId : listingId.toString()), [listingId]);
  const { data: listingRes } = useScaffoldReadContract({
    contractName: "Marketplace",
    functionName: "getListing",
    args: [idBig],
    // don't need to watch aggressively here
    watch: false,
  } as any);
  const pointer = useMemo(() => (listingRes ? (listingRes as any)[0] : undefined), [listingRes]);
  const listingTypeAddress = (pointer?.listingType as string | undefined)?.toLowerCase?.();

  // Minimal ERC20 ABI
  const erc20Abi = useMemo(
    () =>
      [
        {
          type: "function",
          name: "allowance",
          stateMutability: "view",
          inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
          ],
          outputs: [{ name: "", type: "uint256" }],
        },
        {
          type: "function",
          name: "approve",
          stateMutability: "nonpayable",
          inputs: [
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
          ],
          outputs: [{ name: "", type: "bool" }],
        },
      ] as const,
    [],
  );

  const isErc20 = useMemo(() => {
    const pt = (paymentToken || "").toLowerCase();
    return !!pt && pt !== zeroAddress.toLowerCase();
  }, [paymentToken]);

  const ownerAddress = (address || "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const tokenAddress = (paymentToken || "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const spenderAddress = (listingTypeAddress || "0x0000000000000000000000000000000000000000") as `0x${string}`;

  const { data: allowanceData } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [ownerAddress, spenderAddress],
    query: {
      enabled: isErc20 && !!address && !!listingTypeAddress && !!paymentToken,
    },
  } as any);

  const { writeContractAsync: writeTokenAsync } = useWriteContract();

  const doBuy = useCallback(async () => {
    await writeContractAsync({
      functionName: "buyListing",
      args: [idBig, "0x"],
      value: isEth && priceWei ? BigInt(priceWei) : undefined,
    });
  }, [writeContractAsync, idBig, isEth, priceWei]);

  const onBuy = useCallback(async () => {
    try {
      if (isErc20) {
        const needed = priceWei ? BigInt(priceWei) : 0n;
        const current = (allowanceData as bigint | undefined) ?? 0n;
        if (current < needed) {
          const hash = await writeTokenAsync({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "approve",
            args: [spenderAddress, needed],
          } as any);
          if (hash && publicClient) {
            await publicClient.waitForTransactionReceipt({ hash });
          }
        }
      }

      await doBuy();
      setShowReviewPrompt(true);
    } catch {
      // swallow; user may have rejected or tx failed
    }
  }, [isErc20, allowanceData, priceWei, doBuy, writeTokenAsync, tokenAddress, erc20Abi, spenderAddress, publicClient]);

  return (
    <>
      <button className="btn btn-primary" onClick={onBuy} disabled={disabled || isMining}>
        {label}
      </button>
      {/* Approving is now automatic; no modal shown. */}
      {showReviewPrompt ? (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-base-200 rounded-xl shadow-xl p-4 w-full max-w-sm space-y-3">
            <div className="font-semibold">Purchase complete</div>
            <div className="opacity-80 text-sm">Would you like to leave a review now?</div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn btn-ghost" type="button" onClick={() => setShowReviewPrompt(false)}>
                Later
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => {
                  setShowReviewPrompt(false);
                  if (address) router.push(`/user/${address}/review`);
                }}
              >
                Leave a review
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
