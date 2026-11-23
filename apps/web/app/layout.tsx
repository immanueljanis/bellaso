import type { Metadata, Viewport } from "next";
import { EB_Garamond, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const display = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-display",
});
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: new URL("https://bellaso.vercel.app"),
  title: { default: "Bellaso", template: "%s · Bellaso" },
  description: "Private payment links that stay private after Q-Day.",
  openGraph: { images: [{ url: "/brand/cover-1600x900.png", width: 1600, height: 900 }] },
  twitter: { card: "summary_large_image", images: ["/brand/cover-1600x900.png"] },
};

export const viewport: Viewport = { themeColor: "#161D1B", colorScheme: "dark", viewportFit: "cover" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
