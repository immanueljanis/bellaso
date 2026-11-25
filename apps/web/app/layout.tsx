import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: new URL("https://bellaso.vercel.app"),
  title: { default: "Bellaso · Quantum-safe stealth payments", template: "%s · Bellaso" },
  description:
    "Quantum-safe stealth payments on QoreChain. Share one payment link, or give each client a stealth address. ML-KEM-1024 hides the recipient, ML-DSA-87 guards the funds.",
  openGraph: { images: [{ url: "/brand/cover-1600x900.png", width: 1600, height: 900 }] },
  twitter: { card: "summary_large_image", images: ["/brand/cover-1600x900.png"] },
};

export const viewport: Viewport = { themeColor: "#131110", colorScheme: "dark", viewportFit: "cover" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
