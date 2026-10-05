"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";

import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { PageToolbar } from "@/components/common/page-toolbar";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { LookupSelect } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBranches } from "@/features/lookups/hooks/use-lookups";
import { getApiErrorMessage } from "@/services/api-client";

import { JOB_OFFER_STATUS } from "../../types/enums";
import { RECRUITMENT_ROUTES } from "../../constants/routes";
import { useJobOpenings } from "../../openings/hooks/use-job-openings";
import { useOffers } from "../hooks/use-offers";
import type { JobOfferSearch } from "../types/job-offer";
import { OfferTable } from "./offer-table";
import { ReadyToHireWorkspace } from "../../ready-to-hire/components/ready-to-hire-workspace";

const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: JOB_OFFER_STATUS.DRAFT, label: "Draft" },
  { value: JOB_OFFER_STATUS.SENT, label: "Sent" },
  { value: JOB_OFFER_STATUS.ACCEPTED, label: "Accepted" },
  { value: JOB_OFFER_STATUS.DECLINED, label: "Declined" },
  { value: JOB_OFFER_STATUS.REVOKED, label: "Revoked" },
  { value: JOB_OFFER_STATUS.EXPIRED, label: "Expired" },
  { value: JOB_OFFER_STATUS.SUPERSEDED, label: "Superseded" },
];

export function OfferWorkspace() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [jobOpeningId, setJobOpeningId] = useState("");
  const [branchId, setBranchId] = useState("");

  const openingsQuery = useJobOpenings();
  const branchesQuery = useBranches();

  const openingItems =
    openingsQuery.data?.map((opening) => ({
      id: opening.id,
      code: opening.openingCode,
      name: opening.title,
    })) ?? [];

  const filters = useMemo<JobOfferSearch>(
    () => ({
      search: search.trim() || undefined,
      status: status === "ALL" ? undefined : (status as JobOfferSearch["status"]),
      jobOpeningId: jobOpeningId || undefined,
      branchId: branchId || undefined,
    }),
    [search, status, jobOpeningId, branchId],
  );

  const { data = [], isLoading, error, refetch, isFetching } = useOffers(filters);

  return (
    <WorkspaceShell>
      <p className="text-sm text-muted-foreground">
        Prepare, send, and track versioned offers. After acceptance, use Ready to Hire
        to convert candidates to employees.
      </p>

      <KpiGrid columns={3}>
        <KpiCard
          title="Offers"
          value={isLoading ? "—" : data.length}
          icon={FileText}
          density="compact"
        />
        <KpiCard
          title="Awaiting response"
          value={
            isLoading
              ? "—"
              : data.filter((item) => item.status === JOB_OFFER_STATUS.SENT).length
          }
          icon={FileText}
          density="compact"
        />
        <KpiCard
          title="Drafts"
          value={
            isLoading
              ? "—"
              : data.filter((item) => item.status === JOB_OFFER_STATUS.DRAFT).length
          }
          icon={FileText}
          density="compact"
        />
      </KpiGrid>

      <PageToolbar>
        <div className="grid w-full gap-2 md:grid-cols-2 xl:grid-cols-4">
          <Input
            placeholder="Search candidate, application, opening…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <LookupSelect
            value={jobOpeningId}
            onChange={setJobOpeningId}
            items={openingItems}
            loading={openingsQuery.isLoading}
            placeholder="Job opening"
          />
          <LookupSelect
            value={branchId}
            onChange={setBranchId}
            items={branchesQuery.data ?? []}
            loading={branchesQuery.isLoading}
            placeholder="Branch"
          />
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </PageToolbar>

      <OfferTable
        data={data}
        isLoading={isLoading}
        error={
          error ? getApiErrorMessage(error, "We could not load offers.") : null
        }
        onRetry={() => refetch()}
        onRowClick={(offer) =>
          router.push(RECRUITMENT_ROUTES.offers.detail(offer.id))
        }
      />

      <ReadyToHireWorkspace />
    </WorkspaceShell>
  );
}
