"use client";

import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function ProfileLayout({
  children,
}: Props) {
  return (
    <div className="space-y-6 md:space-y-8">
      {children}
    </div>
  );
}