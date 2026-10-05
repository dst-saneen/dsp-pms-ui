import type { ReactNode } from "react";

interface AuthCenteredShellProps {
  children: ReactNode;
}

/** Shared centered shell for compact auth forms. */
export function AuthCenteredShell({ children }: AuthCenteredShellProps) {
  return (
    <div className="relative flex flex-1 items-center justify-center px-4 py-10">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top_left,rgba(231,111,81,0.11),transparent_42%),radial-gradient(circle_at_top_right,rgba(42,157,143,0.10),transparent_40%)]"
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  );
}
