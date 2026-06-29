// Light/dark theme toggle, persisted in localStorage, defaulting to the
// user's OS preference (prefers-color-scheme) on first visit.
(() => {
  const KEY = "sudoku-ai-theme";

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = theme === "dark" ? "🌙" : "☀️";
  }

  function getInitialTheme() {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  const theme = getInitialTheme();
  applyTheme(theme);

  window.addEventListener("DOMContentLoaded", () => {
    applyTheme(getInitialTheme());
    const btn = document.getElementById("themeToggle");
    btn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      localStorage.setItem(KEY, next);
      applyTheme(next);
    });
  });
})();
