import type React from "react";
import type { Metadata } from "next";
import { Geist, Manrope } from "next/font/google";
import "@repo/ui/globals.css";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: {
    default: "Remote Display",
    template: "%s | Remote Display",
  },
  description: "Remote display application for controlling and viewing content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${manrope.variable} antialiased`}
    >
      <body className="font-sans">{children}</body>
    </html>
  );
}
