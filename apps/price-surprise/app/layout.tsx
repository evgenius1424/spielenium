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
  metadataBase: new URL("https://price-suprise-spielenium.vercel.app"),
  title: {
    default: "Price Surprise Game",
    template: "%s | Price Surprise Game",
  },
  description:
    "Join the ultimate online game show! Guess the price of products, compete with friends, and win big in this interactive 'Price Surprise' experience.",
  generator: "v0.app",
  applicationName: "Price Surprise Game",
  keywords: [
    "price game",
    "online game",
    "guess the price",
    "interactive game",
    "game show",
    "multiplayer game",
  ],
  authors: [{ name: "evgenius1424", url: "https://github.com/evgenius1424" }],
  creator: "evgenius1424",
  publisher: "evgenius1424",
  openGraph: {
    title: "Price Surprise Game",
    description:
      "Ready to test your pricing skills? Compete with friends and strangers in this thrilling online game show where you guess the price of everyday items.",
    url: "https://price-suprise-spielenium.vercel.app",
    siteName: "Price Surprise Game",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    site: "@iamevgenius1424",
    creator: "@iamevgenius1424",
    title: "Price Surprise Game: Test Your Skills!",
    description:
      "Think you know prices? Challenge your friends to a game of 'Price Surprise' and see who can guess the closest!",
  },
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
