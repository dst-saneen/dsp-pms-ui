import { AuthCenteredShell } from "@/components/auth/auth-centered-shell";
import { AcceptInvitationForm } from "@/components/auth/accept-invitation-form";

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthCenteredShell>
      <AcceptInvitationForm token={token ?? ""} />
    </AuthCenteredShell>
  );
}
