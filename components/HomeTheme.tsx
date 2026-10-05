"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "dark" | "light" | "system";

type HomeThemeContextValue = {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
};

const THEME_STORAGE_KEY = "course-viewer-home-theme";
const HomeThemeContext = createContext<HomeThemeContextValue | null>(null);

function getStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    const storedMode = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (
      storedMode === "dark" ||
      storedMode === "light" ||
      storedMode === "system"
    ) {
      return storedMode;
    }
  } catch (error) {
    console.error("Could not read the saved theme preference.", error);
  }

  return "system";
}

export function HomeThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    setThemeModeState(getStoredThemeMode());
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    document.documentElement.dataset.theme = mode;
    setThemeModeState(mode);
    document.cookie = `${THEME_STORAGE_KEY}=${mode}; path=/; max-age=31536000; samesite=lax`;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error("Could not save the theme preference.", error);
    }
  };

  return (
    <HomeThemeContext.Provider value={{ themeMode, setThemeMode }}>
      <div className="home-theme min-h-screen" data-theme={themeMode}>
        {children}
      </div>
    </HomeThemeContext.Provider>
  );
}

export function useHomeTheme() {
  const context = useContext(HomeThemeContext);
  if (!context) {
    throw new Error("useHomeTheme must be used inside HomeThemeProvider.");
  }
  return context;
}
