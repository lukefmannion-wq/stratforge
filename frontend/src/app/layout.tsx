import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import UpgradeBannerProvider from '@/components/UpgradeBannerProvider';
import ApiFeedbackProvider from '@/components/ApiFeedbackProvider';
import NavBar from '@/components/NavBar';
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
        <ApiFeedbackProvider>
          <UpgradeBannerProvider>
            <div className="mx-auto flex min-h-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
              <NavBar />
              {children}
            </div>
          </UpgradeBannerProvider>
        </ApiFeedbackProvider>
      </body>
    </html>
  );
}
