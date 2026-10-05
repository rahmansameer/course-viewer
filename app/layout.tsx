import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import AuthGate from "@/components/AuthGate";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-roboto",
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
    <html lang="en" className={`${roboto.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://i.ytimg.com" />
      </head>
      <body className="min-h-full bg-stone-100 text-zinc-900">
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
