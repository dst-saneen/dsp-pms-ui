"use client";

import Link from "next/link";

import { PROJECTS_ROUTES } from "../constants/permissions";

const STEPS = [
  {
    key: "list",
    href: PROJECTS_ROUTES.list,
    label: "1. Projects list (PM)",
  },
  {
    key: "detail",
    href: PROJECTS_ROUTES.list,
    label: "2. Stages → Team → Tasks → Activate",
  },
  {
    key: "my-projects",
    href: PROJECTS_ROUTES.myProjects,
    label: "3. My projects (assignee)",
  },
  {
    key: "my-timesheets",
    href: PROJECTS_ROUTES.myTimesheets,
    label: "4. My timesheets",
  },
  {
    key: "team-timesheets",
    href: PROJECTS_ROUTES.teamTimesheets,
    label: "5. Team timesheets (approve)",
  },
] as const;

export function ProjectsPathBanner({
  current,
  note,
  detailHref,
}: {
  current: (typeof STEPS)[number]["key"];
  note?: string;
  /** When on a project detail page, deep-link step 2 to that project. */
  detailHref?: string;
}) {
  return (
    <div className="mb-4 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
      <p className="font-medium">Projects path</p>
      <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-1 gap-y-1">
        {STEPS.map((step, index) => {
          const href =
            step.key === "detail" && detailHref ? detailHref : step.href;
          const isCurrent = step.key === current;
          return (
            <span key={step.key} className="inline-flex items-center gap-1">
              {index > 0 ? <span aria-hidden="true">→</span> : null}
              <Link
                href={href}
                className={
                  isCurrent
                    ? "font-medium text-foreground underline"
                    : "underline"
                }
              >
                {step.label}
              </Link>
            </span>
          );
        })}
      </p>
      {note ? (
        <p className="text-muted-foreground mt-1 text-xs">{note}</p>
      ) : null}
    </div>
  );
}
