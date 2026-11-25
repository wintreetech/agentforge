"use client";

import { Moon, Sun } from "lucide-react";
import { useIsDark, writeLocal } from "@/lib/client-store";

export const themeScript = `(function(){try{var t=localStorage.getItem('af-theme');var d=t?t==='dark':!window.matchMedia('(prefers-color-scheme: light)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){document.documentElement.classList.add('dark');}})();`;

export function ThemeToggle() {
  const dark = useIsDark();
  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    writeLocal("af-theme", next ? "dark" : "light");
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title="Toggle theme"
    >
      {dark === false ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
    </button>
  );
}
