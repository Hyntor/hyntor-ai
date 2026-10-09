// SM-2 spaced repetition (Phase 3). Pure functions - `now` is always a
// parameter, never read inside, so scheduling is deterministic and
// testable. State lives on the Flashcard row (easeFactor, intervalDays,
// repetitions, nextReviewAt).
//
// The four ratings the student sees map onto SM-2 quality scores:
//   AGAIN -> 2  (failed recall - relearn; card comes back in ~10 minutes)
//   HARD  -> 3  (recalled with serious difficulty)
//   GOOD  -> 4  (recalled with some hesitation)
//   EASY  -> 5  (perfect recall)
// Quality < 3 resets repetitions; the ease factor never drops below 1.3.

export const REVIEW_RATINGS = ["AGAIN", "HARD", "GOOD", "EASY"] as const;
export type ReviewRating = (typeof REVIEW_RATINGS)[number];

const RATING_QUALITY: Record<ReviewRating, number> = { AGAIN: 2, HARD: 3, GOOD: 4, EASY: 5 };

const RELEARN_MINUTES = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface Sm2State {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

export interface Sm2Result extends Sm2State {
  nextReviewAt: Date;
}

export function reviewCard(state: Sm2State, rating: ReviewRating, now = new Date()): Sm2Result {
  const quality = RATING_QUALITY[rating];
  const easeFactor = Math.max(
    1.3,
    state.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  if (quality < 3) {
    // Failed recall: relearn - back in the queue within the session.
    return {
      easeFactor,
      intervalDays: 0,
      repetitions: 0,
      nextReviewAt: new Date(now.getTime() + RELEARN_MINUTES * 60 * 1000),
    };
  }

  const repetitions = state.repetitions + 1;
  const intervalDays =
    repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.round(state.intervalDays * easeFactor);

  return {
    easeFactor,
    intervalDays,
    repetitions,
    nextReviewAt: new Date(now.getTime() + intervalDays * DAY_MS),
  };
}

/** What each rating would schedule - shown on the review buttons
 *  ("Good · 6d") so students learn how the system responds to honesty. */
export function previewIntervals(state: Sm2State): Record<ReviewRating, string> {
  const out = {} as Record<ReviewRating, string>;
  for (const rating of REVIEW_RATINGS) {
    const { intervalDays } = reviewCard(state, rating);
    out[rating] = intervalDays === 0 ? `${RELEARN_MINUTES}m` : `${intervalDays}d`;
  }
  return out;
}
