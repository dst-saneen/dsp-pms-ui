"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";

interface OfferResponseShellProps {
  children: ReactNode;
}

export function OfferResponseShell({ children }: OfferResponseShellProps) {
  return (
    <div className="h-dvh overflow-y-auto bg-[#fffdfa]">
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Offer response</p>
              <p className="font-semibold">Secure candidate portal</p>
            </div>
          </div>
          <Link href="/login" className="text-sm font-medium text-primary hover:underline">
            Employee sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 pb-16 sm:px-6">{children}</main>
    </div>
  );
}
