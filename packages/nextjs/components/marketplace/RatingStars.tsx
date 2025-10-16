"use client";

import React from "react";

type Props = {
  value?: number; // 0-5
  size?: number;
  showCount?: number;
  strikeThrough?: boolean;
};

export const RatingStars: React.FC<Props> = ({ value = 0, size = 16, showCount, strikeThrough }) => {
  const safeValue = isFinite(value) ? Math.max(0, Math.min(5, value)) : 0;
  return (
    <div className={`flex items-center gap-1 ${strikeThrough ? "line-through opacity-60" : ""}`}>
      <span className="flex items-center gap-1 text-yellow-400">
        {[0, 1, 2, 3, 4].map(i => {
          const fillPercent = Math.max(0, Math.min(1, safeValue - i));
          return (
            <span key={i} className="relative inline-block align-middle" style={{ width: size, height: size }}>
              <svg viewBox="0 0 24 24" width={size} height={size} className="absolute top-0 left-0 opacity-30">
                <path
                  d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                  fill="currentColor"
                />
              </svg>
              <span
                className="absolute top-0 left-0 overflow-hidden drop-shadow"
                style={{ width: `${fillPercent * 100}%`, height: size }}
              >
                <svg viewBox="0 0 24 24" width={size} height={size}>
                  <path
                    d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                    fill="currentColor"
                  />
                </svg>
              </span>
            </span>
          );
        })}
      </span>
      {typeof showCount === "number" && <span className="text-xs opacity-70">({showCount})</span>}
    </div>
  );
};

export default RatingStars;
