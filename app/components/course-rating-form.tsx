import { useState } from "react";
import { useFetcher } from "react-router";
import { Star } from "lucide-react";

export function CourseRatingForm({
  slug,
  rating,
}: {
  slug: string;
  rating: number | null;
}) {
  const fetcher = useFetcher<{ success?: boolean; error?: string }>();
  const pending = fetcher.state !== "idle";
  const [preview, setPreview] = useState<number | null>(null);
  const submittedRating = fetcher.formData?.get("rating");
  const selectedRating = submittedRating ? Number(submittedRating) : rating ?? 0;
  const displayedRating = preview ?? selectedRating;

  return (
    <fetcher.Form
      method="post"
      action={`/courses/${slug}`}
      className="min-w-0 border-t pt-4"
    >
      <input type="hidden" name="intent" value="rate-course" />
      <fieldset disabled={pending} className="min-w-0">
        <legend className="text-sm font-semibold">Your rating</legend>
        <div className="mt-2 flex w-fit max-w-full" onMouseLeave={() => setPreview(null)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="submit"
              name="rating"
              value={value}
              aria-label={`Rate ${value} ${value === 1 ? "star" : "stars"}`}
              aria-pressed={selectedRating === value}
              onMouseEnter={() => setPreview(value)}
              onFocus={() => setPreview(value)}
              onBlur={() => setPreview(null)}
              onClick={() => setPreview(null)}
              className="flex size-10 items-center justify-center rounded-md text-amber-500 transition-colors hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
            >
              <Star
                aria-hidden="true"
                className={`size-7 ${value <= displayedRating ? "fill-current" : "fill-none"}`}
              />
            </button>
          ))}
        </div>
      </fieldset>
      <div className="mt-1 text-xs text-muted-foreground" role="status" aria-live="polite">
        {pending
          ? "Saving..."
          : (fetcher.data?.error ??
            (fetcher.data?.success
              ? `Your ${rating}-star rating has been saved.`
              : rating
                ? `${rating} out of 5 stars. Click a star to update.`
                : "Click a star to rate this course."))}
      </div>
    </fetcher.Form>
  );
}
