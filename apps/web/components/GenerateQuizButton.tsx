"use client";

// Calls the AI, then jumps straight into taking the generated quiz.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/trpc";

export function GenerateQuizButton({
  courseId,
  materialId,
  disabled,
  className,
}: {
  courseId: string;
  materialId: string;
  disabled?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const { id } = await api.quiz.generate.mutate({ courseId, materialId, questionCount: 10 });
      router.push(`/quizzes/${id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button
        onClick={generate}
        disabled={busy || disabled}
        className="btn-secondary text-xs"
        title={disabled ? "No extracted text - the AI cannot read this material" : "Generate a practice quiz from this material"}
      >
        {busy ? "Generating... (~20s)" : "Generate quiz"}
      </button>
      {error && <p className="mt-2 max-w-sm text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}
