import { notFound } from "next/navigation";

import { DesignSystemReference } from "@/features/design-system/design-system-reference";

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <DesignSystemReference />;
}
