"use client";

import {
  faArrowRightFromBracket,
  faChevronDown,
  faCircleExclamation,
  faDesktop,
  faMoon,
  faSun,
} from "@fortawesome/free-solid-svg-icons";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import type { User } from "@supabase/auth-js";

import Icon from "@/components/Icon";
import PageTitle from "@/components/PageTitle";
import profilePhoto from "@/app/profile.jpg";
import { HomeThemeProvider, useHomeTheme } from "@/components/HomeTheme";
import {
  readAuthSessionHint,
  setAuthSessionHint,
} from "@/lib/auth-session-hint";
import { getSupabaseClient, type SupabaseClient } from "@/lib/supabase";
import { clearCachedVideos } from "@/lib/storage";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  cachedUserIdHint: string | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthGate.");
  }
  return context;
}

const subscribeToNothing = () => () => {};

export default function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // The layout is static, so the session hint cookie is read in the browser.
  // Until hydration finishes, "/" renders the sign-in form, which the inline
  // script in app/layout.tsx hides for returning users before first paint.
  const isHydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  const [{ hasStoredSession, userIdHint: storedUserIdHint }] =
    useState(readAuthSessionHint);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const supabase = useMemo<SupabaseClient | Error>(() => {
    try {
      return getSupabaseClient();
    } catch (error) {
      return error instanceof Error
        ? error
        : new Error("Could not initialize Supabase.");
    }
  }, []);

  useEffect(() => {
    if (supabase instanceof Error) {
      setAuthError(supabase.message);
      setLoading(false);
      return;
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setAuthSessionHint(session?.user.id ?? null);
        setLoading(false);
      },
    );

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }
        setUser(data.session?.user ?? null);
        setAuthSessionHint(data.session?.user.id ?? null);
        setLoading(false);
      })
      .catch((error: unknown) => {
        setAuthError(
          error instanceof Error
            ? error.message
            : "Could not load your session.",
        );
        setLoading(false);
      });

    return () => authListener.subscription.unsubscribe();
  }, [supabase]);

  const signOut = async () => {
    if (supabase instanceof Error) {
      throw supabase;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    if (user) {
      // The library cache outlives the tab, so don't leave it on a shared device.
      clearCachedVideos(user.id);
    }
    setAuthSessionHint(null);
  };

  if (loading) {
    if (pathname === "/") {
      return (
        <AuthContext.Provider
          value={{ user, loading, cachedUserIdHint: storedUserIdHint, signOut }}
        >
          {isHydrated && hasStoredSession ? (
            <HomeThemeProvider>{children}</HomeThemeProvider>
          ) : (
            <AuthForm hideForStoredSession />
          )}
        </AuthContext.Provider>
      );
    }

    if (pathname.startsWith("/watch/")) {
      return (
        <AuthContext.Provider
          value={{ user, loading, cachedUserIdHint: storedUserIdHint, signOut }}
        >
          <HomeThemeProvider>{children}</HomeThemeProvider>
        </AuthContext.Provider>
      );
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-4">
        <PageTitle />
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-800" />
          Connecting to your library
        </div>
      </main>
    );
  }

  if (authError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-4">
        <PageTitle name="Error" />
        <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-5 text-center">
          <Icon
            icon={faCircleExclamation}
            className="mb-3 text-red-600"
          />
          <p role="alert" className="text-sm leading-6 text-red-800">
            {authError}
          </p>
        </div>
      </main>
    );
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, cachedUserIdHint: null, signOut }}
    >
      {user ? <HomeThemeProvider>{children}</HomeThemeProvider> : <AuthForm />}
    </AuthContext.Provider>
  );
}

function AuthForm({
  hideForStoredSession = false,
}: {
  hideForStoredSession?: boolean;
}) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const supabase = getSupabaseClient();
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signUpError) {
          throw signUpError;
        }
        if (!data.session) {
          setAuthSessionHint(null);
          setConfirmationEmail(email.trim());
        } else {
          setAuthSessionHint(data.session.user.id);
        }
      } else {
        const { data, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
        if (signInError) {
          throw signInError;
        }
        setAuthSessionHint(data.session?.user.id ?? null);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Authentication failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmationEmail) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
        <PageTitle name="Check Your Inbox" />
        <section className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 sm:p-10">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-950">
            Check your inbox
          </h1>
          <p className="mt-4 text-base leading-7 text-zinc-700">
            Confirmation link sent to{" "}
            <span className="font-medium text-zinc-900">
              {confirmationEmail}
            </span>
            .
          </p>
          <button
            type="button"
            className="mt-7 h-12 w-full rounded-lg bg-zinc-950 px-4 text-base font-bold text-white transition hover:bg-zinc-800"
            onClick={() => {
              setConfirmationEmail("");
              setIsSignUp(false);
              setError("");
            }}
          >
            Back to sign in
          </button>
        </section>
      </main>
    );
  }

  return (
    <main
      data-auth-fallback={hideForStoredSession ? "" : undefined}
      className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12"
    >
      <PageTitle name={isSignUp ? "Sign Up" : "Sign In"} />
      <section className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 sm:p-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-950">
            {isSignUp ? "Create account" : "Sign in"}
          </h1>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="auth-email"
              className="mb-2 block text-base font-bold text-zinc-900"
            >
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base font-medium text-zinc-950 outline-none transition placeholder:font-normal placeholder:text-zinc-400 hover:border-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
            />
          </div>
          <div>
            <label
              htmlFor="auth-password"
              className="mb-2 block text-base font-bold text-zinc-900"
            >
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              minLength={6}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={
                isSignUp ? "Create a password" : "Enter your password"
              }
              className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base font-medium text-zinc-950 outline-none transition placeholder:font-normal placeholder:text-zinc-400 hover:border-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
            />
            {isSignUp ? (
              <p className="mt-2 text-sm leading-5 text-zinc-600">
                Minimum 6 characters.
              </p>
            ) : null}
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-3 text-sm font-medium text-red-700"
            >
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="mt-1 h-12 w-full rounded-lg bg-zinc-950 px-4 text-base font-bold text-white transition hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? "Please wait..." : isSignUp ? "Sign up" : "Sign in"}
          </button>
        </form>

        <div className="mt-7 border-t border-zinc-100 pt-6 text-center">
          <p className="text-base text-zinc-700">
            {isSignUp ? "Have an account?" : "New here?"}{" "}
            <button
              type="button"
              className="font-bold text-zinc-950 underline decoration-zinc-300 underline-offset-4 transition hover:decoration-zinc-950"
              onClick={() => {
                setIsSignUp((value) => !value);
                setError("");
              }}
            >
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}

export function AccountButton() {
  const { user, signOut } = useAuth();
  const { themeMode, setThemeMode } = useHomeTheme();
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const email = user?.email ?? "";

  useEffect(() => {
    if (!open) {
      return;
    }

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const handleSignOut = async () => {
    setError("");
    setSigningOut(true);
    try {
      await signOut();
    } catch (signOutError) {
      setError(
        signOutError instanceof Error
          ? signOutError.message
          : "Could not sign out.",
      );
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20"
      >
        <Image
          src={profilePhoto}
          alt=""
          className="h-7 w-7 rounded-full object-cover"
        />
        <Icon
          icon={faChevronDown}
          className="text-[10px] text-zinc-500"
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-lg border border-zinc-200 bg-white p-1.5"
        >
          <div className="px-3 py-2.5">
            <p className="text-xs font-medium text-zinc-500">Signed in as</p>
            <p className="mt-1 truncate text-sm font-medium text-zinc-900">
              {email}
            </p>
          </div>
          <div className="my-1 border-t border-zinc-100" />
          <div className="px-3 py-2.5">
            <p
              id="theme-setting-label"
              className="mb-2 text-xs font-medium text-zinc-500"
            >
              Theme
            </p>
            <div
              role="group"
              aria-labelledby="theme-setting-label"
              className="flex rounded-md border border-zinc-200 p-0.5"
            >
              {(
                [
                  ["light", "Light", faSun],
                  ["dark", "Dark", faMoon],
                  ["system", "System", faDesktop],
                ] as const
              ).map(([mode, label, icon]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={themeMode === mode}
                  aria-label={`${label} theme`}
                  title={label}
                  onClick={() => setThemeMode(mode)}
                  className={`flex h-8 flex-1 items-center justify-center rounded text-sm transition ${
                    themeMode === mode
                      ? "bg-[var(--theme-toggle-active-background)] text-[var(--theme-toggle-active-foreground)] hover:opacity-90"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  <Icon icon={icon} />
                </button>
              ))}
            </div>
          </div>
          <div className="my-1 border-t border-zinc-100" />
          {error ? (
            <p role="alert" className="px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            role="menuitem"
            disabled={signingOut}
            onClick={handleSignOut}
            className="flex h-9 w-full items-center gap-2.5 rounded-md px-3 text-left text-sm text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950 disabled:opacity-60"
          >
            <Icon
              icon={faArrowRightFromBracket}
              className="w-3 text-xs text-zinc-500"
            />
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
