// External libraries
import type { Metadata } from "next";
import { Figtree, Geist_Mono } from "next/font/google";

// Internal imports
import { AppProvider } from "@/providers/app-provider";

// Styles
import "./globals.css";
import { Toaster } from "sonner";

const figtree = Figtree({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "Group ERP",
  title: {
    default: "Group ERP",
    template: "%s | Group ERP",
  },
  description:
    "Enterprise Resource Planning platform for Architecture, Engineering, BIM, and Design Consultancy firms.",
  authors: [{ name: "Group ERP" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${figtree.variable} ${geistMono.variable} h-full font-sans antialiased`}
    >
      <body className="flex h-dvh min-h-0 flex-col overflow-hidden">
        <AppProvider>{children}</AppProvider>
        <Toaster
          richColors
          position="top-right"
          closeButton
        />
      </body>
    </html>
  );
}
