import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PSITS 14 — Convention Kit Order",
  description: "Order the ₱630 PSITS convention kit and securely submit a GCash receipt.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
