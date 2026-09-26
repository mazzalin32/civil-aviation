import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-source-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "CAA Legal", template: "%s · CAA Legal" },
  description: "Uganda Civil Aviation Authority — Legal case and matter management",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Theme: no data-theme = follow the OS. Profile preference sets it from Phase 1 onwards.
  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
