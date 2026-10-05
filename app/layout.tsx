import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { cookies } from "next/headers";

import AuthGate from "@/components/AuthGate";
import { AUTH_SESSION_HINT_COOKIE } from "@/lib/auth-session-hint";
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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const storedSessionHint =
    cookieStore.get(AUTH_SESSION_HINT_COOKIE)?.value ?? null;
  const storedUserIdHint =
    storedSessionHint &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      storedSessionHint,
    )
      ? storedSessionHint
      : null;
  const hasStoredSession =
    storedSessionHint === "1" || storedUserIdHint !== null;
  const storedThemeMode = cookieStore.get("course-viewer-home-theme")?.value;
  const initialThemeMode =
    storedThemeMode === "dark" ||
    storedThemeMode === "light" ||
    storedThemeMode === "system"
      ? storedThemeMode
      : "system";

  return (
    <html
      lang="en"
      className={`${roboto.variable} h-full antialiased`}
      data-theme={initialThemeMode}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try {
  const mode = localStorage.getItem("course-viewer-home-theme");
  document.documentElement.dataset.theme =
    mode === "dark" || mode === "light" || mode === "system" ? mode : "system";
} catch {
  document.documentElement.dataset.theme = "system";
}`,
          }}
        />
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://i.ytimg.com" />
      </head>
      <body className="min-h-full bg-stone-100 text-zinc-900">
        <AuthGate
          hasStoredSession={hasStoredSession}
          storedUserIdHint={storedUserIdHint}
        >
          {children}
        </AuthGate>
      </body>
    </html>
  );
}
