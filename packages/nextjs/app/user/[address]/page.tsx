"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const UserProfilePage = () => {
  const params = useParams<{ address: string }>();
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`https://reviews.api.example.com/reviews/${params?.address}`);
        const json = await res.json();
        setReviews(json.reviews || []);
      } catch {
        setReviews([]);
      }
    };
    load();
  }, [params?.address]);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-semibold">User {params?.address}</h1>
      <div className="space-y-2">
        {reviews.length === 0 ? <p className="opacity-70">No reviews.</p> : null}
        {reviews.map((r, i) => (
          <div key={i} className="p-3 border rounded-xl">
            <div className="font-medium">Rating: {r.rating}</div>
            <div className="text-sm opacity-80">{r.comment}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserProfilePage;
