import { AuthCenteredShell } from "@/components/auth/auth-centered-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthCenteredShell>
      <ResetPasswordForm token={token ?? ""} />
    </AuthCenteredShell>
  );
}
