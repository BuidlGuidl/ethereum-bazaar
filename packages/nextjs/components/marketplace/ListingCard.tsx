import Image from "next/image";
import Link from "next/link";

export interface ListingCardProps {
  id: string | number;
  title: string;
  priceLabel: string;
  imageUrl?: string;
}

export const ListingCard = ({ id, title, priceLabel, imageUrl }: ListingCardProps) => {
  return (
    <Link href={`/listing/${id}`} className="card card-compact bg-base-100 shadow">
      {imageUrl ? (
        <Image src={imageUrl} alt={title} width={800} height={320} className="w-full h-40 object-cover" />
      ) : null}
      <div className="card-body">
        <div className="card-title text-base">{title}</div>
        <div className="opacity-80 text-sm">{priceLabel}</div>
      </div>
    </Link>
  );
};
