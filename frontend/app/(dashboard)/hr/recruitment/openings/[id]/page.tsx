"use client";

import { useParams } from "next/navigation";

import { JobOpeningEditor } from "@/features/recruitment/openings";

export default function JobOpeningDetailPage() {
  const params = useParams();
  const id = params.id as string;

  return <JobOpeningEditor openingId={id} />;
}
