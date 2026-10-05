"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, UserRoundSearch } from "lucide-react";

import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { PageToolbar } from "@/components/common/page-toolbar";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RECRUITMENT_ROUTES } from "../../constants/routes";
import { getApiErrorMessage } from "@/services/api-client";

import { useCandidates } from "../../applications/hooks/use-job-applications";
import { CandidateTable } from "./candidate-table";

export function CandidateWorkspace() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
    }),
    [search],
  );

  const { data = [], isLoading, error, refetch, isFetching } = useCandidates(filters);

  return (
    <WorkspaceShell>
      <p className="text-sm text-muted-foreground">
        People in the hiring pipeline. Each candidate may have one or more applications.
      </p>

      <KpiGrid columns={2}>
        <KpiCard
          title="Candidates"
          value={isLoading ? "—" : data.length}
          icon={UserRoundSearch}
          density="compact"
        />
        <KpiCard
          title="Applications linked"
          value={
            isLoading
              ? "—"
              : data.reduce((sum, item) => sum + item.applicationCount, 0)
          }
          icon={ClipboardList}
          tone="information"
          density="compact"
        />
      </KpiGrid>

      <PageToolbar>
        <div className="flex w-full flex-wrap items-end gap-2">
          <Input
            placeholder="Search name, email, or mobile…"
            className="max-w-md"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="ml-auto">
            <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
              {isFetching ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </div>
      </PageToolbar>

      <CandidateTable
        data={data}
        isLoading={isLoading}
        error={
          error
            ? getApiErrorMessage(error, "We could not load candidates.")
            : null
        }
        onRetry={() => void refetch()}
        onRowClick={(candidate) =>
          router.push(RECRUITMENT_ROUTES.candidates.detail(candidate.id))
        }
      />
    </WorkspaceShell>
  );
}
