"use client";

import { useMemo, useState } from "react";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

import {
  applyCompanyModuleToggle,
  COMPANY_MODULE_DETAILS,
  createCompanyModuleState,
} from "../lib/company-modules";
import type {
  Company,
  CompanyModuleEntitlement,
  CompanyModuleCode,
} from "../types/company";

interface CompanyModulesWorkspaceProps {
  company: Company;
  entitlements: CompanyModuleEntitlement[];
  canManage: boolean;
  isSaving: boolean;
  onSave: (entitlements: CompanyModuleEntitlement[]) => void;
  onBack: () => void;
}

export function CompanyModulesWorkspace({
  company,
  entitlements,
  canManage,
  isSaving,
  onSave,
  onBack,
}: CompanyModulesWorkspaceProps) {
  const sourceState = useMemo(
    () => createCompanyModuleState(entitlements),
    [entitlements],
  );
  const [overrides, setOverrides] = useState<Partial<typeof sourceState>>({});
  const values = { ...sourceState, ...overrides };

  const isDirty = COMPANY_MODULE_DETAILS.some(
    ({ code }) => values[code] !== sourceState[code],
  );

  const toggleModule = (module: CompanyModuleCode, enabled: boolean) => {
    setOverrides((currentOverrides) => {
      const current = { ...sourceState, ...currentOverrides };
      const next = applyCompanyModuleToggle(current, module, enabled);

      return Object.fromEntries(
        Object.entries(next).filter(
          ([code, value]) =>
            value !== sourceState[code as CompanyModuleCode],
        ),
      );
    });
  };

  const save = () => {
    onSave(
      COMPANY_MODULE_DETAILS.map(({ code }) => ({
        module: code,
        isEnabled: values[code],
      })),
    );
  };

  return (
    <PageContainer className="pb-24">
      <PageHeader
        title="Modules & Features"
        description={`Control which product modules are available to ${company.companyName}. All new Companies start with the standard module set enabled.`}
      />

      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Dependencies stay consistent automatically. Enabling a feature also
          enables its requirements; disabling a required feature also disables
          features that depend on it.
        </div>

        {!canManage ? (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            You can review this Company configuration. Company management
            permission is required to change it.
          </div>
        ) : null}

        <div className="divide-y rounded-xl border bg-card">
          {COMPANY_MODULE_DETAILS.map((item) => {
            const controlId = `company-module-${item.code.toLowerCase()}`;
            const requirements = item.requires
              ?.map(
                (required) =>
                  COMPANY_MODULE_DETAILS.find(({ code }) => code === required)
                    ?.label ?? required,
              )
              .join(" and ");

            return (
              <div
                key={item.code}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1 pr-4">
                  <label htmlFor={controlId} className="font-medium">
                    {item.label}
                  </label>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                  {requirements ? (
                    <p className="text-xs text-muted-foreground">
                      Requires {requirements}. Required modules are enabled
                      automatically.
                    </p>
                  ) : null}
                </div>
                <Switch
                  id={controlId}
                  aria-label={item.label}
                  checked={values[item.code]}
                  disabled={!canManage || isSaving}
                  onCheckedChange={(enabled) =>
                    toggleModule(item.code, enabled)
                  }
                />
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky bottom-0 z-20 -mx-3 mt-6 border-t px-3 py-3 backdrop-blur sm:-mx-4 sm:px-4 md:-mx-5 md:px-5 xl:-mx-6 xl:px-6"
        role="region"
        aria-label="Modules and features actions"
      >
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onBack}>
            Back to company
          </Button>
          {canManage ? (
            <Button
              type="button"
              disabled={!isDirty || isSaving}
              onClick={save}
            >
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
          ) : null}
        </div>
      </div>
    </PageContainer>
  );
}
