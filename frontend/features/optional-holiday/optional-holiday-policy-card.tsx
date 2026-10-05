"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LookupSelect } from "@/components/forms";
import { useLeaveTypes } from "@/features/leave-type/hooks/use-leave-types";
import { getApiErrorMessage } from "@/services/api-client";
import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";

export interface CompanyHolidayPolicy {
  id: string;
  companyId: string;
  year: number;
  maximumHolidayDays: number;
  optionalHolidayLeaveTypeId: string;
  isActive: boolean;
  optionalHolidayLeaveType?: {
    id: string;
    leaveCode: string;
    leaveName: string;
    category: string;
  };
}

export interface HolidayPolicySetupStatus {
  companyId: string;
  year: number;
  policyConfigured: boolean;
  maximumHolidayDays: number | null;
  mandatoryWorkingDayCount: number;
  optionalAllowance: number | null;
  minimumMaximumNeeded: number;
  conflict: boolean;
  message: string | null;
  fixPath: string;
}

async function fetchPolicies(companyId: string, year: number) {
  const response = await apiClient.get<ApiResponse<CompanyHolidayPolicy[]>>(
    "/company-holiday-policies",
    { params: { companyId, year } }
  );
  const data = unwrapApiData(response.data);
  return Array.isArray(data) ? data : [];
}

async function fetchSetupStatus(companyId: string, year: number) {
  const response = await apiClient.get<ApiResponse<HolidayPolicySetupStatus>>(
    `/company-holiday-policies/${companyId}/${year}/setup-status`
  );
  return unwrapApiData(response.data);
}

async function upsertPolicy(
  companyId: string,
  year: number,
  body: { maximumHolidayDays: number; optionalHolidayLeaveTypeId: string }
) {
  const response = await apiClient.put<ApiResponse<CompanyHolidayPolicy>>(
    `/company-holiday-policies/${companyId}/${year}`,
    body
  );
  return unwrapApiData(response.data);
}

interface OptionalHolidayPolicyCardProps {
  companyId: string;
}

export function OptionalHolidayPolicyCard({ companyId }: OptionalHolidayPolicyCardProps) {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const yearNumber = Number(year) || currentYear;
  const [policyDraft, setPolicyDraft] = useState<{
    key: string;
    maximumHolidayDays: string;
    leaveTypeId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const { data: leaveTypes = [], isLoading: leaveTypesLoading } = useLeaveTypes(companyId);
  const optionalLeaveTypes = useMemo(
    () =>
      leaveTypes
        .filter((type) => type.category === "OPTIONAL_HOLIDAY")
        .map((type) => ({
          id: type.id,
          code: type.leaveCode,
          name: type.leaveName,
        })),
    [leaveTypes]
  );

  const policyQuery = useQuery({
    queryKey: ["company-holiday-policies", companyId, yearNumber],
    queryFn: () => fetchPolicies(companyId, yearNumber),
    enabled: Boolean(companyId) && Number.isFinite(yearNumber),
  });

  const setupQuery = useQuery({
    queryKey: ["company-holiday-policy-setup", companyId, yearNumber],
    queryFn: () => fetchSetupStatus(companyId, yearNumber),
    enabled: Boolean(companyId) && Number.isFinite(yearNumber),
  });

  const policyKey = `${companyId}:${yearNumber}`;
  const existingPolicy = policyQuery.data?.[0];
  const activeDraft = policyDraft?.key === policyKey ? policyDraft : null;
  const maximumHolidayDays =
    activeDraft?.maximumHolidayDays ?? String(existingPolicy?.maximumHolidayDays ?? 10);
  const leaveTypeId = activeDraft?.leaveTypeId ?? existingPolicy?.optionalHolidayLeaveTypeId ?? "";

  function updatePolicyDraft(update: Partial<Omit<NonNullable<typeof policyDraft>, "key">>) {
    setPolicyDraft((current) => ({
      key: policyKey,
      maximumHolidayDays:
        update.maximumHolidayDays ??
        (current?.key === policyKey ? current.maximumHolidayDays : maximumHolidayDays),
      leaveTypeId:
        update.leaveTypeId ?? (current?.key === policyKey ? current.leaveTypeId : leaveTypeId),
    }));
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertPolicy(companyId, yearNumber, {
        maximumHolidayDays: Number(maximumHolidayDays),
        optionalHolidayLeaveTypeId: leaveTypeId,
      }),
    onSuccess: async () => {
      setError(null);
      setSavedMessage("Holiday policy saved.");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["company-holiday-policies", companyId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["company-holiday-policy-setup", companyId],
        }),
      ]);
    },
    onError: (err) => {
      setSavedMessage(null);
      setError(getApiErrorMessage(err, "Could not save holiday policy."));
    },
  });

  const setup = setupQuery.data;

  return (
    <Card id="annual-holiday-policy">
      <CardHeader>
        <CardTitle className="text-base">Annual holiday policy</CardTitle>
        <p className="text-muted-foreground text-xs">
          Set the yearly holiday maximum and link the Optional Holiday leave type. Optional days
          available to employees = max − mandatory working holidays.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-4">
        {setup?.conflict || setup?.message ? (
          <div
            className={`rounded-lg border p-3 text-sm sm:col-span-4 ${
              setup.conflict
                ? "border-destructive/40 bg-destructive/5 text-destructive"
                : "border-amber-500/40 bg-amber-500/5 text-amber-950 dark:text-amber-100"
            }`}
            role="alert"
          >
            {setup.conflict ? (
              <>
                <p className="font-medium">Employees cannot pick floating holidays yet</p>
                <div className="mt-2 grid gap-1 text-xs sm:grid-cols-3">
                  <p>
                    Current maximum: <strong>{setup.maximumHolidayDays ?? "—"}</strong>
                  </p>
                  <p>
                    Mandatory holidays: <strong>{setup.mandatoryWorkingDayCount}</strong>
                  </p>
                  <p>
                    Minimum maximum needed: <strong>{setup.minimumMaximumNeeded}</strong>
                  </p>
                </div>
                <p className="mt-2 text-xs opacity-90">
                  Set <strong>Maximum holidays</strong> to at least{" "}
                  <strong>{setup.minimumMaximumNeeded}</strong>
                  {setup.minimumMaximumNeeded > 0
                    ? ` (add more if you also want floating picks, e.g. ${setup.minimumMaximumNeeded + 2})`
                    : ""}
                  , then Save. Or remove some Mandatory holidays on the calendar and Publish.
                </p>
              </>
            ) : (
              <p>{setup.message}</p>
            )}
          </div>
        ) : setup?.policyConfigured ? (
          <div className="text-muted-foreground border-border bg-muted/30 rounded-lg border p-3 text-xs sm:col-span-4">
            <p>
              Current: Maximum <strong>{setup.maximumHolidayDays}</strong> · Mandatory{" "}
              <strong>{setup.mandatoryWorkingDayCount}</strong> · Employees can choose{" "}
              <strong>{setup.optionalAllowance ?? 0}</strong>
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="oh-year">Year</Label>
          <Input
            id="oh-year"
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              setSavedMessage(null);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="oh-max">Maximum holidays</Label>
          <Input
            id="oh-max"
            type="number"
            min={1}
            max={366}
            value={maximumHolidayDays}
            onChange={(e) => {
              updatePolicyDraft({ maximumHolidayDays: e.target.value });
              setSavedMessage(null);
            }}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Optional Holiday leave type</Label>
          <LookupSelect
            value={leaveTypeId}
            onChange={(value) => {
              updatePolicyDraft({ leaveTypeId: value });
              setSavedMessage(null);
            }}
            items={optionalLeaveTypes}
            loading={leaveTypesLoading}
            placeholder={
              optionalLeaveTypes.length
                ? "Select leave type"
                : "Create an OPTIONAL_HOLIDAY leave type first"
            }
            clearable={false}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-4">
          <Button
            type="button"
            disabled={saveMutation.isPending || !leaveTypeId || !Number(maximumHolidayDays)}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "Saving…" : "Save policy"}
          </Button>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          {savedMessage ? <p className="text-muted-foreground text-sm">{savedMessage}</p> : null}
          {policyQuery.isLoading || setupQuery.isLoading ? (
            <p className="text-muted-foreground text-sm">Loading policy…</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
