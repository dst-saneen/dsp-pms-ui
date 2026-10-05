"use client";

import { useQuery } from "@tanstack/react-query";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { OnboardingTemplateVersionService } from "@/features/onboarding-template/services";

interface ExecutableAssetType {
  id: string;
  assetTypeName: string;
  assetTypeCode: string;
  trackingMode: "INDIVIDUAL" | "POOL" | "LOCATION" | null;
}

interface Props {
  versionId: string;
  value?: string | null;
  onChange(assetType: ExecutableAssetType): void;
}

export function AssetTypeSelect({ versionId, value, onChange }: Props) {
  const { data: assetTypes = [], isLoading } = useQuery({
    queryKey: ["onboarding-template-asset-types", versionId],
    queryFn: () =>
      OnboardingTemplateVersionService.listExecutableAssetTypes(versionId),
    enabled: Boolean(versionId),
  });

  const selected = assetTypes.find((item) => item.id === value);

  return (
    <div className="space-y-1">
      <Select
        value={value ?? ""}
        onValueChange={(nextId) => {
          const next = assetTypes.find((item) => item.id === nextId);
          if (next) {
            onChange(next);
          }
        }}
        disabled={!versionId || isLoading}
      >
        <SelectTrigger>
          <SelectValue
            placeholder={
              isLoading ? "Loading asset types..." : "Select Asset Type"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {assetTypes
            .filter((item) => item.trackingMode !== "LOCATION")
            .map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.assetTypeName}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      {selected?.trackingMode && (
        <p className="text-sm text-muted-foreground">
          Tracking mode: {selected.trackingMode}
        </p>
      )}
      {!versionId && (
        <p className="text-sm text-destructive">
          Template version is missing, so Asset Types cannot load.
        </p>
      )}
      {Boolean(versionId) && !isLoading && assetTypes.length === 0 && (
        <p className="text-sm text-destructive">
          No executable Asset Types for this company. Create a Laptop
          (Hardware / Individual) Asset Type first.
        </p>
      )}
    </div>
  );
}
