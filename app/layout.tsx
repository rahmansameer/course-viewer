import type { Metadata } from "next";
import { Roboto } from "next/font/google";

import AuthGate from "@/components/AuthGate";
import { AUTH_SESSION_HINT_SCRIPT } from "@/lib/auth-session-hint";
import { SITE_NAME } from "@/lib/site";
import { STORAGE_MIGRATION_SCRIPT } from "@/lib/storage-migration";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  applicationName: SITE_NAME,
  description:
    "Personal library for tracking long-form YouTube videos and courses.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${roboto.variable} h-full antialiased`}
      data-theme="system"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `${STORAGE_MIGRATION_SCRIPT}
try {
  const mode = localStorage.getItem("youtube-course-viewer-home-theme");
  document.documentElement.dataset.theme =
    mode === "dark" || mode === "light" || mode === "system" ? mode : "system";
} catch {
  document.documentElement.dataset.theme = "system";
}
${AUTH_SESSION_HINT_SCRIPT}`,
          }}
        />
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://i.ytimg.com" />
      </head>
      <body className="min-h-full bg-stone-100 text-zinc-900">
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
