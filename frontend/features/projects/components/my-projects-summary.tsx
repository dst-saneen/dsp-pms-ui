import {
  AlertCircle,
  Clock3,
  FileText,
  Send,
  type LucideIcon,
} from "lucide-react";

import type { MyProjectsSummary as MyProjectsSummaryValue } from "../lib/my-projects-view-model";

interface MyProjectsSummaryProps {
  summary: MyProjectsSummaryValue | null;
  loading: boolean;
}

const summarySections: Array<{
  key: keyof MyProjectsSummaryValue;
  label: string;
  detail: (summary: MyProjectsSummaryValue) => string;
  Icon: LucideIcon;
  iconClassName: string;
}> = [
  { key: "assigned", label: "Assigned tasks", detail: (summary) => `Across ${summary.projectCount} ${summary.projectCount === 1 ? "project" : "projects"}`, Icon: FileText, iconClassName: "bg-information-soft text-information" },
  { key: "inProgress", label: "In progress", detail: () => "Currently being worked on", Icon: Clock3, iconClassName: "bg-brand-secondary-soft text-brand-secondary" },
  { key: "awaitingReview", label: "Awaiting review", detail: () => "Submitted to project manager", Icon: Send, iconClassName: "bg-primary-soft text-primary" },
  { key: "overdue", label: "Overdue", detail: () => "Needs your attention", Icon: AlertCircle, iconClassName: "bg-danger-soft text-destructive" },
];

export function MyProjectsSummary({ summary, loading }: MyProjectsSummaryProps) {
  if (!summary && !loading) return null;

  return (
    <section aria-labelledby="my-projects-summary-title" className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3 sm:px-5">
        <h2 id="my-projects-summary-title" className="font-heading text-base font-semibold">My work summary</h2>
      </div>
      {loading ? (
        <div role="status" className="grid grid-cols-2 divide-x divide-y divide-border md:grid-cols-4 md:divide-y-0">
          <span className="sr-only">Loading assigned project tasks</span>
          {summarySections.map((section) => <div key={section.key} className="min-h-30 animate-pulse p-4 sm:p-5"><div className="size-10 rounded-lg bg-muted" /><div className="mt-3 h-3 w-20 rounded bg-muted" /><div className="mt-2 h-6 w-10 rounded bg-muted" /></div>)}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 divide-x divide-y divide-border md:grid-cols-4 md:divide-y-0">
          {summarySections.map(({ key, label, detail, Icon, iconClassName }) => (
            <div key={key} className="min-w-0 p-4 sm:p-5">
              <div className="flex min-w-0 items-start gap-3">
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}><Icon className="size-5" aria-hidden="true" /></span>
                <div className="min-w-0"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-0.5 text-2xl font-semibold tracking-tight">{summary[key]}</p><p className="mt-1 truncate text-xs text-muted-foreground">{detail(summary)}</p></div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
