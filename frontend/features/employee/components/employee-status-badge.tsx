import {
  StatusBadge,
  type StatusTone,
} from "@/components/common/status-badge";

interface Props {
  status: string;
}

export function getEmployeeStatusTone(status: string): StatusTone {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return "success";
    case "PROBATION":
      return "information";
    case "NOTICE":
      return "warning";
    case "TERMINATED":
      return "danger";
    default:
      return "neutral";
  }
}

export function getEmployeeStatusLabel(status: string) {
  const value = status.trim();
  if (!value) return "Unknown";

  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function EmployeeStatusBadge({
  status,
}: Props) {
  return (
    <StatusBadge
      label={getEmployeeStatusLabel(status)}
      tone={getEmployeeStatusTone(status)}
    />
  );
}
