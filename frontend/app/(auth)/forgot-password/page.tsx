import { AuthCenteredShell } from "@/components/auth/auth-centered-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthCenteredShell>
      <ForgotPasswordForm />
    </AuthCenteredShell>
  );
}
