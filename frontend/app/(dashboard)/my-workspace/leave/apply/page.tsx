import { redirect } from "next/navigation";

export default function LegacyApplyLeavePage() {
  return redirect("/my-workspace/leave?action=apply");
}
