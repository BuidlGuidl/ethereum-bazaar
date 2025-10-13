"use client";

import React from "react";

type Props = {
  value?: number; // 0-5
  size?: number;
  showCount?: number;
  strikeThrough?: boolean;
};

export const RatingStars: React.FC<Props> = ({ value = 0, size = 16, showCount, strikeThrough }) => {
  const fullStars = Math.floor(value);
  const half = value - fullStars >= 0.5;
  const empty = 5 - fullStars - (half ? 1 : 0);
  return (
    <div className={`flex items-center gap-1 text-yellow-400 ${strikeThrough ? "line-through opacity-60" : ""}`}>
      {Array.from({ length: fullStars }).map((_, i) => (
        <span key={`f-${i}`} style={{ fontSize: size }} aria-label="full-star">
          ★
        </span>
      ))}
      {half && (
        <span style={{ fontSize: size }} aria-label="half-star" className="opacity-60">
          ★
        </span>
      )}
      {Array.from({ length: empty }).map((_, i) => (
        <span key={`e-${i}`} style={{ fontSize: size }} className="opacity-30" aria-label="empty-star">
          ★
        </span>
      ))}
      {typeof showCount === "number" && <span className="text-xs opacity-70">({showCount})</span>}
    </div>
  );
};

export default RatingStars;
