"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { OfferResponseWorkspace } from "@/features/recruitment/offer-response";

function OfferResponsePageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  return <OfferResponseWorkspace token={token} />;
}

export default function OfferResponsePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
          Loading offer…
        </div>
      }
    >
      <OfferResponsePageContent />
    </Suspense>
  );
}
