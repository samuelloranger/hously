import { useState, useEffect } from "react";

export function useTheme() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Initialize theme from localStorage or system preference
    const theme = localStorage.getItem("theme");
    const darkMode =
      theme === "dark" ||
      (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
    
    setIsDark(darkMode);
    
    // Apply theme to document
    if (darkMode) {
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "light";
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = isDark ? "light" : "dark";
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
    document.documentElement.style.colorScheme = newTheme;
    localStorage.setItem("theme", newTheme);
  };

  return { isDark, toggleTheme };
}

