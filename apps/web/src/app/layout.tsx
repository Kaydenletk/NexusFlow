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
    "Student Life Intelligence Dashboard for rhythm, progress, and personal activity signals.",
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
        <div className="mx-auto min-h-screen max-w-7xl px-6 py-10">
          <header className="rounded-[2rem] border border-white/70 bg-white/70 p-6 shadow-panel backdrop-blur">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="font-mono text-xs uppercase tracking-[0.35em] text-slate-500">
                  NexusFlow
                </p>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
                  Student life signals, shaped into a readable rhythm.
                </h1>
                <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
                  Start with coding activity as the first validated daily signal,
                  then grow toward a broader view of work, learning, and digital behavior.
                </p>
              </div>
              <Navigation />
            </div>
          </header>
          <main className="mt-8 space-y-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
