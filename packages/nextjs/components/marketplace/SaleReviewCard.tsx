"use client";

import { useCallback, useMemo, useState } from "react";
import { encodeAbiParameters } from "viem";
import { useAccount, useChainId } from "wagmi";
import { RatingStars } from "~~/components/marketplace/RatingStars";
import { ReviewCard } from "~~/components/marketplace/ReviewCard";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";
import { uploadJSON } from "~~/services/ipfs/upload";
import { getEasConfig } from "~~/utils/eas";

export type SaleReview = {
  listingId: string;
  creator: string;
  buyer: string;
  title?: string | null;
  image?: string | null;
};

type Props = {
  sale: SaleReview;
  role: "buyer" | "seller";
  onSubmitted?: (payload: {
    listingId: string;
    rating: number;
    commentIPFSHash: string;
    comment?: string;
    reviewer?: string;
    reviewee?: string;
  }) => void;
};

export const SaleReviewCard = ({ sale, role, onSubmitted }: Props) => {
  const chainId = useChainId();
  const { address } = useAccount();
  const eas = useMemo(() => getEasConfig(chainId), [chainId]);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [optimisticShown, setOptimisticShown] = useState(false);
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "EAS" });

  const reviewee = useMemo(() => (role === "buyer" ? sale.creator : sale.buyer), [role, sale.creator, sale.buyer]);

  const doSubmit = useCallback(async () => {
    if (!eas?.reviewSchemaUid || !eas?.easAddress) return;
    setSubmitting(true);
    // Immediately show optimistic review card
    setOptimisticShown(true);
    try {
      // Upload comment JSON to IPFS if provided, else empty string
      let commentIPFSHash = "";
      if (comment && comment.trim().length > 0) {
        const cid = await uploadJSON({ listingId: sale.listingId, reviewer: address, role, comment });
        commentIPFSHash = cid;
      }

      // Optimistically notify parent immediately so UI switches to ReviewCard
      onSubmitted?.({
        listingId: sale.listingId,
        rating,
        commentIPFSHash,
        comment,
        reviewer: address?.toLowerCase(),
        reviewee: reviewee?.toLowerCase(),
      });

      // Encode data per schema: (uint256 listingId,uint8 rating,string commentIPFSHash)
      const data = encodeAbiParameters(
        [
          { name: "listingId", type: "uint256" },
          { name: "rating", type: "uint8" },
          { name: "commentIPFSHash", type: "string" },
        ],
        [BigInt(sale.listingId), rating, commentIPFSHash],
      );

      // Attest via EAS
      await writeContractAsync({
        functionName: "attest",
        args: [
          {
            schema: eas.reviewSchemaUid as `0x${string}`,
            data: {
              recipient: reviewee as `0x${string}`,
              expirationTime: 0n,
              revocable: true,
              refUID: "0x0000000000000000000000000000000000000000000000000000000000000000",
              data,
              value: 0n,
            },
          },
        ],
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    eas?.reviewSchemaUid,
    eas?.easAddress,
    comment,
    sale.listingId,
    rating,
    address,
    role,
    reviewee,
    writeContractAsync,
    onSubmitted,
  ]);

  return (
    <div className="space-y-3">
      <div className="text-sm">
        <Address address={reviewee as `0x${string}`} />
      </div>
      {optimisticShown ? (
        <ReviewCard rating={rating} comment={comment} reviewer={"you"} />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <div className="relative inline-block select-none" aria-label="rating-stars">
              <RatingStars value={rating} size={20} />
              <div className="absolute inset-0 flex">
                {[1, 2, 3, 4, 5].map(s => (
                  <button
                    key={s}
                    className="flex-1 opacity-0 cursor-pointer"
                    onClick={() => setRating(s)}
                    type="button"
                    aria-label={`Set rating to ${s}`}
                    title={`${s} stars`}
                  />
                ))}
              </div>
            </div>
          </div>
          <textarea
            className="textarea textarea-bordered w-full"
            placeholder="Share details about your experience (optional)"
            value={comment}
            onChange={e => setComment(e.target.value)}
          />
          <button className="btn btn-primary" onClick={doSubmit} disabled={submitting || isMining}>
            {submitting || isMining ? "Submitting..." : "Submit Review"}
          </button>
        </>
      )}
    </div>
  );
};

export default SaleReviewCard;
