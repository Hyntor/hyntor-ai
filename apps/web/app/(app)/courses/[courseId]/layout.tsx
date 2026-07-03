// Course shell: every page inside one course gets the persistent tab bar
// (Overview / Group chat / Discussions / Workspaces / Smart study / Upload).
// Pure navigation - no data fetching, so it adds zero request weight.
import type { ReactNode } from "react";
import { CourseTabs } from "@/components/CourseTabs";

export default async function CourseLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  return (
    <div>
      <CourseTabs courseId={courseId} />
      {children}
    </div>
  );
}
