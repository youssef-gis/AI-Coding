import { Star } from "lucide-react";

export function CourseRating({
  averageRating,
  ratingCount,
}: {
  averageRating: number | null;
  ratingCount: number;
}) {
  const label =
    ratingCount > 0 && averageRating !== null
      ? `${averageRating.toFixed(1)} out of 5 from ${ratingCount} ${ratingCount === 1 ? "rating" : "ratings"}`
      : "No ratings yet";
  return (
    <div
      className="my-2 flex flex-wrap items-center gap-2 text-sm"
      role="img"
      aria-label={label}
    >
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} className="relative size-4 text-amber-500">
            <Star className="size-4" />
            <span
              className="absolute inset-0 overflow-hidden"
              style={{
                width: `${Math.max(0, Math.min(1, (averageRating ?? 0) - star + 1)) * 100}%`,
              }}
            >
              <Star className="size-4 fill-current" />
            </span>
          </span>
        ))}
      </span>
      <span aria-hidden="true" className="text-muted-foreground">
        {ratingCount > 0 && averageRating !== null ? (
          <>
            <span className="font-semibold text-foreground">
              {averageRating.toFixed(1)}
            </span>{" "}
            ({ratingCount} {ratingCount === 1 ? "rating" : "ratings"})
          </>
        ) : (
          "No ratings yet"
        )}
      </span>
    </div>
  );
}
