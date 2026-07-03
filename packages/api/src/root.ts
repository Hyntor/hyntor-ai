// The app router - the single API surface consumed by web AND mobile.
import { router } from "./trpc";
import { userRouter } from "./routers/user";
import { courseRouter } from "./routers/course";
import { materialRouter } from "./routers/material";
import { tutorRouter } from "./routers/tutor";
import { quizRouter } from "./routers/quiz";
import { workspaceRouter } from "./routers/workspace";
import { discussionRouter } from "./routers/discussion";
import { studyRouter } from "./routers/study";
import { flashcardRouter } from "./routers/flashcard";
import { leaderboardRouter } from "./routers/leaderboard";
import { annotationRouter } from "./routers/annotation";
import { courseChatRouter } from "./routers/courseChat";
import { visualizerRouter } from "./routers/visualizer";

export const appRouter = router({
  user: userRouter,
  course: courseRouter,
  material: materialRouter,
  tutor: tutorRouter,
  quiz: quizRouter,
  workspace: workspaceRouter,
  discussion: discussionRouter,
  study: studyRouter,
  flashcard: flashcardRouter,
  leaderboard: leaderboardRouter,
  annotation: annotationRouter,
  courseChat: courseChatRouter,
  visualizer: visualizerRouter,
});

export type AppRouter = typeof appRouter;
