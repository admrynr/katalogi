import { useEffect, useState } from "react";

export function useTheme() {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("theme") === "dark";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (dark)
        document.documentElement.classList.add("dark");
      else
        document.documentElement.classList.remove("dark");

      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {}
  }, [dark]);

  return [dark, setDark];
}
