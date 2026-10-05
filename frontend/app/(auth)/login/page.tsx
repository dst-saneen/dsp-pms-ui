import { Suspense } from "react";
import { LoaderCircle } from "lucide-react";

import { LoginExperience } from "@/components/auth/login-experience";

function LoginFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
      <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
      Loading sign-in…
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginExperience />
    </Suspense>
  );
}
