import Link from "next/link";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { PROJECTS_ROUTES } from "@/features/projects/constants/permissions";

/** Resource heatmap is deferred; explain instead of silent redirect. */
export default function ProjectsResourcesPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Project resources"
        description="Resource heatmap is not available in this release."
      />
      <div className="rounded-lg border border-dashed px-5 py-10 text-center text-sm text-muted-foreground">
        <p>
          The resources / heatmap view is deferred. Use Projects list and
          project Team / Time tabs instead.
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link href={PROJECTS_ROUTES.list}>Go to Projects</Link>
        </Button>
      </div>
    </PageContainer>
  );
}
