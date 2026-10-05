"use client";

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
import { usePublicOpening } from "../hooks/use-public-careers";
import { PublicApplicationForm } from "./public-application-form";

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

interface PublicJobDetailProps {
  companyCode: string;
  openingCode: string;
}

export function PublicJobDetail({ companyCode, openingCode }: PublicJobDetailProps) {
  const openingQuery = usePublicOpening(companyCode, openingCode);

  if (openingQuery.isPending) {
    return <p className="text-sm text-muted-foreground">Loading job details…</p>;
  }

  if (openingQuery.error || !openingQuery.data) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center">
        <p className="font-medium">Job opening not found</p>
        <Link
          href={RECRUITMENT_PUBLIC_ROUTES.careers(companyCode)}
          className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
        >
          Back to careers
        </Link>
      </div>
    );
  }

  const opening = openingQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={RECRUITMENT_PUBLIC_ROUTES.careers(companyCode)}
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Back to all openings
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{opening.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{opening.companyName}</p>
          </div>
          {opening.canApply ? (
            <Badge>Open for applications</Badge>
          ) : opening.isExpired ? (
            <Badge variant="secondary">Deadline passed</Badge>
          ) : (
            <Badge variant="secondary">Closed</Badge>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Role overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Location:</span>{" "}
              {opening.location ?? opening.branchLocation ?? "—"}
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
          {opening.description ? (
            <div>
              <p className="text-muted-foreground">About the role</p>
              <p className="mt-1 whitespace-pre-wrap">{opening.description}</p>
            </div>
          ) : null}
          {opening.closingMessage ? (
            <p className="text-muted-foreground">{opening.closingMessage}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Apply for this role</CardTitle>
        </CardHeader>
        <CardContent>
          {opening.canApply ? (
            <PublicApplicationForm companyCode={companyCode} opening={opening} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {opening.closingMessage ??
                "This opening is not accepting applications right now."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
