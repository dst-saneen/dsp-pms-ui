import { Lock, Building2, FileQuestion } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";

type AuthzVariant = "unauthorized" | "context-required" | "not-found";

const COPY: Record<
  AuthzVariant,
  { icon: typeof Lock; title: string; description: string }
> = {
  unauthorized: {
    icon: Lock,
    title: "You do not have access",
    description:
      "Your role cannot perform this action. Ask an administrator if you need access.",
  },
  "context-required": {
    icon: Building2,
    title: "Select Company and Branch",
    description:
      "Choose an organization context in the header, then try again.",
  },
  "not-found": {
    icon: FileQuestion,
    title: "Record not found",
    description:
      "This record may have been deleted or is outside your organization scope.",
  },
};

interface AuthzStateProps {
  variant: AuthzVariant;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function AuthzState({
  variant,
  title,
  description,
  actionLabel,
  onAction,
}: AuthzStateProps) {
  const preset = COPY[variant];

  return (
    <EmptyState
      icon={preset.icon}
      title={title ?? preset.title}
      description={description ?? preset.description}
      actionLabel={actionLabel}
      onAction={onAction}
    />
  );
}
