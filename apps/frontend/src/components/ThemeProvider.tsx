"use client";
import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  resolvedTheme: "light",
  setTheme: () => {},
});

const KEY = "sv_dashboard_theme";

function getSystem(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyResolved(resolved: "light" | "dark") {
  if (typeof window === "undefined") return;

  const css = window.document.createElement("style");
  css.appendChild(window.document.createTextNode(`
    * {
      -webkit-transition: none !important;
      -moz-transition: none !important;
      -o-transition: none !important;
      -ms-transition: none !important;
      transition: none !important;
    }
  `));
  window.document.head.appendChild(css);

  try {
    const path = window.location.pathname;
    if (path === "/" || path === "/login") {
      const root = document.documentElement;
      root.classList.remove("dark");
      root.style.backgroundColor = "#f8fafc";
      return;
    }
    const root = document.documentElement;
    if (resolved === "dark") {
      root.classList.add("dark");
      root.style.backgroundColor = "#0d0f17";
    } else {
      root.classList.remove("dark");
      root.style.backgroundColor = "#f8fafc";
    }
  } finally {
    // Force reflow
    const _ = window.getComputedStyle(css).opacity;
    window.document.head.removeChild(css);
  }
}

export function applyDashboardTheme() {
  try {
    const t = (localStorage.getItem(KEY) as Theme) || "light";
    const resolved = t === "system" ? getSystem() : t;
    applyResolved(resolved);
  } catch {}
}

export function forceLight() {
  document.documentElement.classList.remove("dark");
  document.documentElement.style.backgroundColor = "#f8fafc";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme,         setThemeState]    = useState<Theme>("light");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved   = (localStorage.getItem(KEY) as Theme) || "light";
    const resolved = saved === "system" ? getSystem() : saved;
    setThemeState(saved);
    setResolvedTheme(resolved);
    applyResolved(resolved);

    // Watch system changes only when theme=system
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if ((localStorage.getItem(KEY) as Theme) === "system") {
        const nr = getSystem();
        setResolvedTheme(nr);
        applyResolved(nr);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem(KEY, t);
    const resolved = t === "system" ? getSystem() : t;
    setResolvedTheme(resolved);
    applyResolved(resolved);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);