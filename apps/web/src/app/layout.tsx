import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import type { ReactNode } from "react";

import { Navigation } from "../components/navigation";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "NexusFlow",
  description:
    "Local-first focus intelligence dashboard for burnout, deep work, and context switching.",
  icons: {
    icon: "/nexusflow-mark.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${manrope.variable} ${ibmPlexMono.variable} font-sans antialiased`}
      >
        <div className="mx-auto min-h-screen max-w-7xl px-6 py-8">
          <header className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img
                src="/nexusflow-mark.svg"
                alt="NexusFlow logo"
                className="h-9 w-9 rounded-xl shadow-sm"
              />
              <span className="text-lg font-semibold tracking-tight text-ink">
                NexusFlow
              </span>
            </div>
            <Navigation />
          </header>
          <main className="mt-8 space-y-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
