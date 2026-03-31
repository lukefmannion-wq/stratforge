import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StratForge Growth",
  description: "AI-powered lead identification for consultants.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-50 text-zinc-900">
        <div className="mx-auto flex min-h-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
            <Link href="/pipeline" className="text-lg font-semibold text-slate-900">
              StratForge Growth
            </Link>
            <nav className="flex flex-wrap items-center gap-3">
              <Link href="/pipeline" className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50">
                Pipeline
              </Link>
              <Link href="/profile" className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50">
                Profile
              </Link>
              <Link href="/leads" className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50">
                Leads
              </Link>
              <Link href="/outreach" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700">
                Outreach
              </Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
