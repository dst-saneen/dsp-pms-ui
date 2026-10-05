'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Shield } from 'lucide-react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { OpsPathBanner } from '@/features/delivery/components/ops-path-banner';
import { apiClient, unwrapApiData, getApiErrorMessage } from '@/services/api-client';

interface RetentionPolicy {
  id: string;
  retentionClass: string;
  retentionRule: string;
  retentionValue: number;
  enabled: boolean;
  version: number;
  approvedAt: string | null;
  updatedAt: string;
}

const CLASS_LABELS: Record<string, string> = {
  PUBLIC_UPLOAD_ORPHAN: 'Public upload orphans',
  RECRUITMENT_UNSUCCESSFUL: 'Unsuccessful recruitment files',
  RECRUITMENT_HIRED: 'Hired recruitment files',
  EMPLOYEE_RECORD: 'Employee records',
  PROJECT_RECORD: 'Project records',
  INFECTED_OR_FAILED_SCAN: 'Infected or failed scans',
  FINANCE_RECORD: 'Finance records',
  PAYROLL_PAYSLIP: 'Payroll payslips',
};

const RULE_OPTIONS = [
  { value: 'HOURS', label: 'Hours' },
  { value: 'DAYS', label: 'Days' },
  { value: 'MONTHS', label: 'Months' },
  { value: 'YEARS', label: 'Years' },
] as const;

export default function DocumentRetentionPage() {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Partial<RetentionPolicy>>>({});

  const { data: policies = [], isLoading, error } = useQuery<RetentionPolicy[]>({
    queryKey: ['document-retention-policies'],
    queryFn: async () => {
      const res = await apiClient.get('/settings/security/document-retention');
      return unwrapApiData(res.data) as RetentionPolicy[];
    },
    retry: false,
  });

  const denied =
    (error as { response?: { status?: number } } | null)?.response?.status === 403;

  const saveMutation = useMutation({
    mutationFn: async (policy: {
      retentionClass: string;
      retentionRule: string;
      retentionValue: number;
      enabled: boolean;
      approve: boolean;
    }) => {
      const res = await apiClient.patch(
        `/settings/security/document-retention/${encodeURIComponent(policy.retentionClass)}`,
        {
          retentionRule: policy.retentionRule,
          retentionValue: policy.retentionValue,
          enabled: policy.enabled,
          approve: policy.approve,
        },
      );
      return unwrapApiData(res.data);
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.approve
          ? 'Retention policy saved and approved (version bumped).'
          : 'Retention draft saved. Approve when ready — purge stays off until the retention flag is on.',
      );
      queryClient.invalidateQueries({ queryKey: ['document-retention-policies'] });
      setDrafts((current) => {
        const next = { ...current };
        delete next[variables.retentionClass];
        return next;
      });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Could not update retention policy.'));
    },
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Document Retention</h1>
        <p className="text-sm text-muted-foreground mt-2">Loading policies…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">Document Retention</h1>
        <OpsPathBanner
          current="retention"
          note="Requires files.retention.manage. Linked documents, signatures, and legal holds are never purged from this screen."
        />
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {denied
              ? 'You do not have permission to manage document retention (files.retention.manage).'
              : 'Failed to load retention policies.'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const rows =
    policies.length > 0
      ? policies
      : Object.keys(CLASS_LABELS).map((retentionClass) => ({
          id: retentionClass,
          retentionClass,
          retentionRule: 'DAYS',
          retentionValue: 30,
          enabled: false,
          version: 0,
          approvedAt: null,
          updatedAt: new Date().toISOString(),
        }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Document Retention</h1>
        <p className="text-sm text-muted-foreground">
          Configure how long unreferenced files are kept. Saving drafts does not
          delete anything. Approve records authority; purge stays disabled until
          the retention feature flag is enabled after reconciliation.
        </p>
      </div>

      <OpsPathBanner
        current="retention"
        note="Save = draft values. Approve = mark policy approved (version bump). Neither button runs a purge from this UI."
      />

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Object keys, buckets and scanner payloads are never shown here. Enabling a
          policy does not delete files that still have a document, signature or legal
          hold. Check storage health first on{' '}
          <Link href="/administration/operations/files" className="underline">
            File operations
          </Link>
          .
        </AlertDescription>
      </Alert>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No retention policies are configured for this company yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((policy) => {
            const draft = drafts[policy.retentionClass] ?? {};
            const retentionRule = draft.retentionRule ?? policy.retentionRule;
            const retentionValue = draft.retentionValue ?? policy.retentionValue;
            const enabled = draft.enabled ?? policy.enabled;
            const ruleValue = RULE_OPTIONS.some((r) => r.value === retentionRule)
              ? retentionRule
              : 'DAYS';
            const policyLabel = CLASS_LABELS[policy.retentionClass] ?? policy.retentionClass;
            const controlIdPrefix = `document-retention-${policy.retentionClass
              .toLowerCase()
              .replaceAll('_', '-')}`;
            const policyLabelId = `${controlIdPrefix}-label`;
            const ruleInputId = `${controlIdPrefix}-rule`;
            const ruleLabelId = `${ruleInputId}-label`;
            const valueInputId = `${controlIdPrefix}-value`;
            const valueLabelId = `${valueInputId}-label`;
            const enabledInputId = `${controlIdPrefix}-enabled`;
            const enabledLabelId = `${enabledInputId}-label`;
            return (
              <Card key={policy.retentionClass}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex flex-wrap items-center gap-2">
                    <span id={policyLabelId}>{policyLabel}</span>
                    {policy.approvedAt ? (
                      <Badge className="bg-green-100 text-green-800 text-xs">Approved</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Draft
                      </Badge>
                    )}
                    {policy.version > 0 ? (
                      <Badge variant="outline" className="text-xs font-mono">
                        v{policy.version}
                      </Badge>
                    ) : null}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-4 items-end">
                  <div className="space-y-1">
                    <Label htmlFor={ruleInputId} id={ruleLabelId}>
                      Rule
                    </Label>
                    <Select
                      value={ruleValue}
                      onValueChange={(value) =>
                        setDrafts((current) => ({
                          ...current,
                          [policy.retentionClass]: {
                            ...current[policy.retentionClass],
                            retentionRule: value,
                          },
                        }))
                      }
                    >
                      <SelectTrigger
                        aria-labelledby={`${policyLabelId} ${ruleLabelId}`}
                        id={ruleInputId}
                      >
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {RULE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={valueInputId} id={valueLabelId}>
                      Value
                    </Label>
                    <Input
                      aria-labelledby={`${policyLabelId} ${valueLabelId}`}
                      id={valueInputId}
                      type="number"
                      min={1}
                      value={retentionValue}
                      onChange={(e) =>
                        setDrafts((current) => ({
                          ...current,
                          [policy.retentionClass]: {
                            ...current[policy.retentionClass],
                            retentionValue: Number(e.target.value),
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2 pb-2">
                    <Switch
                      aria-labelledby={`${policyLabelId} ${enabledLabelId}`}
                      checked={enabled}
                      id={enabledInputId}
                      onCheckedChange={(checked) =>
                        setDrafts((current) => ({
                          ...current,
                          [policy.retentionClass]: {
                            ...current[policy.retentionClass],
                            enabled: checked,
                          },
                        }))
                      }
                    />
                    <Label htmlFor={enabledInputId} id={enabledLabelId}>
                      Enabled
                    </Label>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      aria-label={`Save ${policyLabel}`}
                      variant="outline"
                      size="sm"
                      disabled={saveMutation.isPending}
                      title="Save draft values without approving. Does not purge files."
                      onClick={() =>
                        saveMutation.mutate({
                          retentionClass: policy.retentionClass,
                          retentionRule: ruleValue,
                          retentionValue: Number(retentionValue),
                          enabled,
                          approve: false,
                        })
                      }
                    >
                      Save draft
                    </Button>
                    <Button
                      aria-label={`Approve ${policyLabel}`}
                      size="sm"
                      disabled={saveMutation.isPending}
                      title="Save and mark approved. Still does not purge; purge needs the retention feature flag."
                      onClick={() =>
                        saveMutation.mutate({
                          retentionClass: policy.retentionClass,
                          retentionRule: ruleValue,
                          retentionValue: Number(retentionValue),
                          enabled,
                          approve: true,
                        })
                      }
                    >
                      Save & approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
