import type { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#FBF8F5]">
      {children}
    </main>
  );
}
