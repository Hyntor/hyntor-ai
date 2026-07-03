import Link from "next/link";
import { serverApi } from "@/lib/server-api";
import { CrossUniversityBadge, EmptyState, MaterialTypeBadge, PageHeader } from "@/components/ui";
import { GenerateQuizButton } from "@/components/GenerateQuizButton";

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const api = await serverApi();
  const course = await api.course.get({ courseId });

  return (
    <div>
      <PageHeader
        title={`${course.code} - ${course.title}`}
        subtitle={`${course.subject} - ${course.memberCount} enrolled${
          course.isCrossUniversity && course.universityCount > 1
            ? ` from ${course.universityCount} universities`
            : ""
        }`}
        action={
          <div className="flex flex-wrap gap-3">
            <Link href={`/tutor?courseId=${course.id}`} className="btn-secondary">
              Ask the tutor
            </Link>
            <Link href={`/visualizer?courseId=${course.id}`} className="btn-secondary">
              Visualize
            </Link>
            <Link href={`/courses/${course.id}/upload`} className="btn-primary">
              Upload material
            </Link>
          </div>
        }
      />
      {course.isCrossUniversity && (
        <div className="-mt-2 mb-4">
          <CrossUniversityBadge />
        </div>
      )}
      {course.description && <p className="mb-8 max-w-3xl text-sm font-medium leading-relaxed text-slate-600">{course.description}</p>}

      <div className="grid gap-8 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Library</p>
              <h2 className="font-display text-xl font-semibold text-ink">Shared materials</h2>
            </div>
            <span className="text-xs font-bold text-slate-400">{course.materials.length} files</span>
          </div>
          {course.materials.length === 0 ? (
            <EmptyState
              title="No materials yet"
              body="Upload the first lecture notes, slides, syllabus, homework, or test so the AI tutor can ground answers in this class."
              cta="Upload the first material"
              href={`/courses/${course.id}/upload`}
            />
          ) : (
            <div className="space-y-3">
              {course.materials.map((material) => (
                <div key={material.id} className="surface-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Link
                      href={`/materials/${material.id}`}
                      className="font-semibold text-ink hover:text-brand-700"
                    >
                      {material.title}
                    </Link>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400">
                      <MaterialTypeBadge type={material.type} />
                      <span>by {material.uploaderName}</span>
                      <span>{new Date(material.createdAt).toLocaleDateString()}</span>
                      {!material.hasText && <span className="font-bold text-amber-600">No extracted text</span>}
                    </p>
                  </div>
                  <GenerateQuizButton
                    courseId={course.id}
                    materialId={material.id}
                    disabled={!material.hasText}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-2">
          <div className="mb-3">
            <p className="eyebrow">Practice</p>
            <h2 className="font-display text-xl font-semibold text-ink">Quizzes</h2>
          </div>
          {course.quizzes.length === 0 ? (
            <p className="card text-sm font-medium text-slate-500">
              No quizzes yet. Generate one from any material with extracted text.
            </p>
          ) : (
            <div className="space-y-3">
              {course.quizzes.map((quiz) => (
                <Link key={quiz.id} href={`/quizzes/${quiz.id}`} className="card-interactive block p-4">
                  <p className="text-sm font-semibold text-ink">{quiz.title}</p>
                  <p className="mt-1 text-xs font-medium text-slate-400">
                    {quiz.isMockExam ? "Mock exam - " : ""}
                    {quiz.attemptCount} attempt{quiz.attemptCount === 1 ? "" : "s"} -{" "}
                    {new Date(quiz.createdAt).toLocaleDateString()}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
