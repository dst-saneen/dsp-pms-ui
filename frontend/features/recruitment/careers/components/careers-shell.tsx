"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Briefcase } from "lucide-react";

interface CareersShellProps {
  companyName?: string;
  children: ReactNode;
}

export function CareersShell({ companyName, children }: CareersShellProps) {
  return (
    <div className="h-dvh overflow-y-auto bg-[#fffdfa]">
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Briefcase className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Careers</p>
              <p className="font-semibold">{companyName ?? "Open positions"}</p>
            </div>
          </div>
          <Link href="/login" className="text-sm font-medium text-primary hover:underline">
            Employee sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
