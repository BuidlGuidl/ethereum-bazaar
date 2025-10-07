export const ReviewCard = ({ rating, comment, reviewer }: { rating: number; comment: string; reviewer?: string }) => {
  return (
    <div className="p-3 border rounded-xl">
      <div className="font-medium">Rating: {rating}/5</div>
      <div className="text-sm opacity-80">{comment}</div>
      {reviewer ? <div className="text-xs opacity-60 mt-1">by {reviewer}</div> : null}
    </div>
  );
};
