"use client";

import { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function EditorLayout({
  children,
}: Props) {
  return (
    <div className="flex h-full flex-col bg-background">
      {children}
    </div>
  );
}