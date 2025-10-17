import RatingStars from "~~/components/marketplace/RatingStars";

export const ReviewCard = ({ rating, comment, reviewer }: { rating: number; comment: string; reviewer?: string }) => {
  return (
    <div className="p-3 border rounded-xl">
      <div className="flex items-center gap-2">
        <RatingStars value={rating} size={18} />
      </div>
      <div className="text-sm opacity-80 mt-1">{comment}</div>
      {reviewer ? <div className="text-xs opacity-60 mt-1">by {reviewer}</div> : null}
    </div>
  );
};
