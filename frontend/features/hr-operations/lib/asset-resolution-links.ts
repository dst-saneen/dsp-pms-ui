export type AssetResolutionLink = {
  href: string;
  label: string;
};

export function getAssetResolutionLinks(
  assetModuleAvailable: boolean,
  hasPermission: (permission: string) => boolean
): AssetResolutionLink[] {
  if (!assetModuleAvailable) return [];

  return [
    hasPermission("assets.assignments.read")
      ? { href: "/asset-management/employee-assets", label: "Assigned to employees" }
      : null,
    hasPermission("assets.assignments.read") ||
    hasPermission("assets.department.assignments.read")
      ? { href: "/asset-management/inbox", label: "Custodian Inbox" }
      : null,
    hasPermission("assets.clearance.waive")
      ? { href: "/asset-management/waivers", label: "Clearance waivers" }
      : null,
    hasPermission("assets.assets.read") || hasPermission("assets.department.read")
      ? { href: "/asset-management/transfers", label: "Transfers" }
      : null,
  ].filter((link): link is AssetResolutionLink => Boolean(link));
}
