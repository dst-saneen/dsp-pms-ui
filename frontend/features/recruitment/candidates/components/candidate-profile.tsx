"use client";

import { useRouter } from "next/navigation";

import { EditorHeader } from "@/components/editor/editor-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RECRUITMENT_ROUTES } from "../../constants/routes";
import { formatApplicationSource } from "../../applications/utils/application-actions";
import { useCandidate, useCandidateApplications } from "../../applications/hooks/use-job-applications";
import { JobApplicationTable } from "../../applications/components/job-application-table";

interface CandidateProfileProps {
  candidateId: string;
}

export function CandidateProfile({ candidateId }: CandidateProfileProps) {
  const router = useRouter();
  const candidateQuery = useCandidate(candidateId);
  const applicationsQuery = useCandidateApplications(candidateId);

  if (candidateQuery.isLoading) {
    return <div className="p-6">Loading candidate…</div>;
  }

  const candidate = candidateQuery.data;
  if (!candidate) {
    return <div className="p-6">Candidate not found.</div>;
  }

  return (
    <div className="space-y-6">
      <EditorHeader
        title={`${candidate.firstName} ${candidate.lastName}`}
        subtitle={candidate.email}
      />

      <Card>
        <CardHeader>
          <CardTitle>Candidate details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Email: </span>
            {candidate.email}
          </div>
          <div>
            <span className="text-muted-foreground">Mobile: </span>
            {candidate.mobile ?? "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Primary source: </span>
            {formatApplicationSource(candidate.primarySource)}
          </div>
          <div>
            <span className="text-muted-foreground">Applications: </span>
            {candidate.applicationCount}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Applications</h2>
        <JobApplicationTable
          data={applicationsQuery.data ?? []}
          isLoading={applicationsQuery.isLoading}
          onRowClick={(application) =>
            router.push(RECRUITMENT_ROUTES.applications.detail(application.id))
          }
        />
      </div>
    </div>
  );
}
