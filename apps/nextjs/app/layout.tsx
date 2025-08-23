import type React from "react";
import type {Metadata} from "next";
import {Geist, Manrope} from "next/font/google";
import "@repo/ui/guess-the-price.css";

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Guess the Price Game",
  description: "Interactive game show experience with 3 players",
  generator: "v0.app",
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
