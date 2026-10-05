import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { PublicApplicationReceipt } from "../types/public-careers";

interface ApplicationSuccessReceiptProps {
  receipt: PublicApplicationReceipt;
  openingTitle?: string;
}

export function ApplicationSuccessReceipt({
  receipt,
  openingTitle,
}: ApplicationSuccessReceiptProps) {
  return (
    <Card role="status" aria-live="polite">
      <CardHeader>
        <CardTitle>Application received</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {openingTitle ? (
          <p className="text-muted-foreground">
            Role: <span className="text-foreground font-medium">{openingTitle}</span>
          </p>
        ) : null}
        <p>{receipt.message}</p>
        <p className="text-muted-foreground">
          Reference:{" "}
          <span className="text-foreground font-medium">
            {receipt.receiptReference}
          </span>
        </p>
        <p className="text-muted-foreground">
          Keep this reference for your records. Our team will reach out if your
          profile progresses. No further action is needed right now.
        </p>
      </CardContent>
    </Card>
  );
}
