import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AuthGate from "@/components/AuthGate";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Course Viewer",
  description:
    "Personal library for tracking long-form YouTube videos and courses.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-stone-100 text-zinc-900">
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
