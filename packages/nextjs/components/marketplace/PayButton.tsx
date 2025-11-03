"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { keccak256, stringToHex, zeroAddress } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";

export interface PayButtonProps {
  listingId: string | number;
  priceWei?: string; // pass as string to avoid bigint serialization issues
  paymentToken?: string; // zero address for ETH; otherwise ERC20
  disabled?: boolean;
  listingTypeAddress?: string; // spender/listing type contract address passed from parent
}

export const PayButton = ({ listingId, priceWei, paymentToken, disabled, listingTypeAddress }: PayButtonProps) => {
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

  const idBig = useMemo(() => BigInt(typeof listingId === "number" ? listingId : listingId.toString()), [listingId]);
  const listingTypeSpenderLower = useMemo(
    () => (listingTypeAddress ? listingTypeAddress.toLowerCase() : undefined),
    [listingTypeAddress],
  );

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
    return !!pt && pt !== zeroAddress;
  }, [paymentToken]);

  const ownerAddress = (address || zeroAddress) as `0x${string}`;
  const tokenAddress = (paymentToken || zeroAddress) as `0x${string}`;
  const spenderAddress = (listingTypeSpenderLower || zeroAddress) as `0x${string}`;

  const { data: allowanceData } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [ownerAddress, spenderAddress],
    query: {
      enabled: isErc20 && !!address && !!listingTypeSpenderLower && !!paymentToken,
    },
  } as any);

  const { writeContractAsync: writeTokenAsync } = useWriteContract();

  const doBuy = useCallback(async () => {
    const sigHash = keccak256(stringToHex("buy(uint256,address,bool,address,bytes)"));
    const selector = `0x${sigHash.slice(2, 10)}` as `0x${string}`;
    const action = (selector + "0".repeat(64 - 8)) as `0x${string}`; // left-pad selector (4 bytes) to 32 bytes
    await writeContractAsync({
      functionName: "callAction",
      args: [idBig, action, "0x"],
      value: isEth && priceWei ? BigInt(priceWei) : undefined,
    });
  }, [writeContractAsync, idBig, isEth, priceWei]);

  const onBuy = useCallback(async () => {
    try {
      // Prevent approving zero address if listing type (spender) isn't available yet
      if (isErc20 && !listingTypeSpenderLower) {
        return;
      }
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
  }, [
    isErc20,
    listingTypeSpenderLower,
    allowanceData,
    priceWei,
    doBuy,
    writeTokenAsync,
    tokenAddress,
    erc20Abi,
    spenderAddress,
    publicClient,
  ]);

  return (
    <>
      <button
        className="btn btn-primary"
        onClick={onBuy}
        disabled={disabled || isMining || (isErc20 && !listingTypeSpenderLower)}
      >
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
