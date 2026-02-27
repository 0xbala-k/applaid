import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "applaid dashboard",
  description: "Autonomous job application agent"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <header className="border-b border-slate-800">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <span className="text-sm font-semibold uppercase tracking-widest text-slate-300">
              applaid
            </span>
            <nav className="flex gap-4 text-sm text-slate-300">
              <Link href="/">Dashboard</Link>
              <Link href="/preferences">Preferences</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
