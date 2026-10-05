import type { JobOffer } from "../types/job-offer";

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatMoney(amount: number, currency: string, period: string) {
  return `${currency} ${amount.toLocaleString()} (${period.toLowerCase()})`;
}

interface OfferSummaryCardProps {
  offer: JobOffer;
}

export function OfferSummaryCard({ offer }: OfferSummaryCardProps) {
  return (
    <div className="space-y-3 rounded-xl border p-4 text-sm">
      <div className="grid gap-2 sm:grid-cols-2">
        <p>
          <span className="text-muted-foreground">Candidate:</span> {offer.candidateName}
        </p>
        <p>
          <span className="text-muted-foreground">Role:</span> {offer.roleTitle}
        </p>
        <p>
          <span className="text-muted-foreground">Reporting manager:</span>{" "}
          {offer.reportingManagerName ?? "—"}
        </p>
        <p>
          <span className="text-muted-foreground">Joining date:</span>{" "}
          {formatDate(offer.joiningDate)}
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
          <span className="text-muted-foreground">Probation:</span> {offer.probationDays}{" "}
          days
        </p>
        <p>
          <span className="text-muted-foreground">Expires:</span>{" "}
          {formatDate(offer.expiryDate)}
        </p>
        <p>
          <span className="text-muted-foreground">Organization:</span>{" "}
          {offer.organization.branchName} · {offer.organization.designationName}
        </p>
      </div>
      {offer.terms ? (
        <div>
          <p className="text-muted-foreground">Terms</p>
          <p className="mt-1 whitespace-pre-wrap">{offer.terms}</p>
        </div>
      ) : null}
    </div>
  );
}
