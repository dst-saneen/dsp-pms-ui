import Link from "next/link";

import { cn } from "@/lib/utils";

interface SignInLinkProps {
  className?: string;
}

export function SignInLink({ className }: SignInLinkProps) {
  return (
    <p className={cn("text-[14px] text-[#7D8798]", className)}>
      Already have an account?{" "}
      <Link
        href="/login"
        className="font-semibold hover:underline"
        style={{ color: "#F15A43" }}
      >
        Sign in
      </Link>
    </p>
  );
}
