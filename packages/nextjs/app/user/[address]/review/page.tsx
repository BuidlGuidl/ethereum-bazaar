"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

const ReviewFormPage = () => {
  const params = useParams<{ address: string }>();
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // TODO: send EAS attestation
      await fetch("https://reviews.api.example.com/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewedUser: params?.address, rating, comment }),
      });
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="p-4 space-y-3" onSubmit={submit}>
      <h1 className="text-2xl font-semibold">Leave a Review</h1>
      <input
        type="number"
        min={1}
        max={5}
        className="input input-bordered"
        value={rating}
        onChange={e => setRating(parseInt(e.target.value) || 1)}
      />
      <textarea
        className="textarea textarea-bordered w-full"
        placeholder="Comment"
        value={comment}
        onChange={e => setComment(e.target.value)}
      />
      <button className="btn btn-primary" disabled={submitting}>
        {submitting ? "Submitting..." : "Submit"}
      </button>
    </form>
  );
};

export default ReviewFormPage;
