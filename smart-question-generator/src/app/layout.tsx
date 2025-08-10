import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Smart Question Generator",
  description: "Generate MCQs and open-ended questions aligned to Bloom&apos;s Taxonomy.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-slate-900 dark:bg-[#0b1220] dark:text-slate-100`}>
        <header className="border-b border-slate-200/80 dark:border-slate-800 sticky top-0 bg-white/80 dark:bg-[#0b1220]/80 backdrop-blur z-50">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-semibold tracking-tight text-xl text-sky-700 dark:text-sky-400">Smart Question Generator</Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/" className="hover:text-sky-600 dark:hover:text-sky-300">Create</Link>
              <Link href="/results" className="hover:text-sky-600 dark:hover:text-sky-300">Results</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
