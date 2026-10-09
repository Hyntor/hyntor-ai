import Link from "next/link";
import { serverApi } from "@/lib/server-api";
import { MaterialTypeBadge, PageHeader } from "@/components/ui";
import { GenerateQuizButton } from "@/components/GenerateQuizButton";
import { UpvoteButton } from "@/components/UpvoteButton";
import { AnnotationsPanel } from "@/components/AnnotationsPanel";

export default async function MaterialPage({
  params,
}: {
  params: Promise<{ materialId: string }>;
}) {
  const { materialId } = await params;
  const api = await serverApi();
  const material = await api.material.get({ materialId });

  return (
    <div>
      <PageHeader
        title={material.title}
        subtitle={`${material.course.code} - uploaded by ${material.uploaderName} - ${new Date(material.createdAt).toLocaleDateString()}`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <UpvoteButton
              materialId={material.id}
              initialCount={material.upvoteCount}
              initialUpvoted={material.upvotedByMe}
              isMine={material.isMine}
            />
            <Link href={`/tutor?courseId=${material.course.id}`} className="btn-secondary">
              Ask about this
            </Link>
            <GenerateQuizButton
              courseId={material.course.id}
              materialId={material.id}
              disabled={!material.extractedText}
            />
          </div>
        }
      />
      <p className="mb-4 flex flex-wrap items-center gap-3">
        <MaterialTypeBadge type={material.type} />
        <Link href={`/courses/${material.course.id}`} className="text-sm font-bold text-brand-600 hover:text-brand-700">
          Back to {material.course.code}
        </Link>
        {material.fileUrl.startsWith("http") && (
          // Original file lives in object storage (Vercel Blob) - open it.
          <a
            href={material.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-bold text-brand-600 hover:text-brand-700"
          >
            Open original file
          </a>
        )}
      </p>

      <div className="card">
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-slate-400">
          Extracted text read by the tutor
        </h2>
        {material.extractedText ? (
          <pre className="max-h-[36rem] overflow-y-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
            {material.extractedText}
          </pre>
        ) : (
          <p className="text-sm font-medium leading-relaxed text-amber-700">
            No text could be extracted from this material, so the AI tutor cannot use it. If it is a scanned PDF, try an OCR version or paste the content as text from the upload page.
          </p>
        )}
      </div>

      <AnnotationsPanel materialId={material.id} />
    </div>
  );
}
