import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RECRUITMENT_PUBLIC_ROUTES } from "../../constants/routes";
import { EMPLOYMENT_TYPE_OPTIONS } from "../../openings/constants/employment-types";
import type { PublicJobOpeningListItem } from "../types/public-careers";

function formatEmploymentType(value: string) {
  return (
    EMPLOYMENT_TYPE_OPTIONS.find((option) => option.value === value)?.label ??
    value.replaceAll("_", " ")
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface PublicOpeningCardProps {
  companyCode: string;
  opening: PublicJobOpeningListItem;
}

export function PublicOpeningCard({ companyCode, opening }: PublicOpeningCardProps) {
  return (
    <Card className={opening.isExpired ? "opacity-70" : undefined}>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-lg">{opening.title}</CardTitle>
          {opening.isExpired ? (
            <Badge variant="secondary">Deadline passed</Badge>
          ) : (
            <Badge>Open</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-1 sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Location:</span>{" "}
            {opening.branchLocation ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Employment type:</span>{" "}
            {formatEmploymentType(opening.employmentType)}
          </p>
          <p>
            <span className="text-muted-foreground">Apply by:</span>{" "}
            {formatDate(opening.applicationDeadline)}
          </p>
        </div>
        <Link
          href={RECRUITMENT_PUBLIC_ROUTES.jobDetail(companyCode, opening.openingCode)}
          className="inline-flex text-sm font-medium text-primary hover:underline"
        >
          {opening.isExpired ? "View role" : "View role and apply"}
        </Link>
      </CardContent>
    </Card>
  );
}
