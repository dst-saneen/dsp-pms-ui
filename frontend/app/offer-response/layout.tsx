import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offer response",
  referrer: "no-referrer",
};

export default function OfferResponseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
