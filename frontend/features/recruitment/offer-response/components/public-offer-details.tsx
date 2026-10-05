import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EMPLOYMENT_TYPE_OPTIONS } from "../../openings/constants/employment-types";
import type { PublicOfferSnapshot } from "../types/offer-response";

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

function formatMoney(amount: number, currency: string, period: string) {
  return `${currency} ${amount.toLocaleString()} (${period.toLowerCase()})`;
}

interface PublicOfferDetailsProps {
  offer: PublicOfferSnapshot;
}

export function PublicOfferDetails({ offer }: PublicOfferDetailsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Offer details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Role:</span> {offer.roleTitle}
          </p>
          <p>
            <span className="text-muted-foreground">Company:</span>{" "}
            {offer.companyName ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Location:</span>{" "}
            {offer.branchName ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Designation:</span>{" "}
            {offer.designationName ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Reporting manager:</span>{" "}
            {offer.reportingManagerName ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Employment type:</span>{" "}
            {formatEmploymentType(offer.employmentType)}
          </p>
          <p>
            <span className="text-muted-foreground">Joining date:</span>{" "}
            {formatDate(offer.joiningDate)}
          </p>
          <p>
            <span className="text-muted-foreground">Offer expires:</span>{" "}
            {formatDate(offer.expiryDate)}
          </p>
          <p>
            <span className="text-muted-foreground">Compensation:</span>{" "}
            {formatMoney(
              offer.compensation.amount,
              offer.compensation.currency,
              offer.compensation.period,
            )}
          </p>
          <p>
            <span className="text-muted-foreground">Probation:</span>{" "}
            {offer.probationDays} days
          </p>
        </div>
        {offer.terms ? (
          <div>
            <p className="text-muted-foreground">Terms</p>
            <p className="mt-1 whitespace-pre-wrap">{offer.terms}</p>
          </div>
        ) : null}
        <p className="text-muted-foreground">Version {offer.versionNumber}</p>
      </CardContent>
    </Card>
  );
}
