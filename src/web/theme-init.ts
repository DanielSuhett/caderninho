// Copied as a small standalone script, independent of React and allowed by CSP.
// Keep the source valid JavaScript.
(() => {
  const root = document.documentElement;
  const key = "caderninho.theme";
  function applyTheme(mode = "dark") {
    root.dataset.mode = mode;
    document.dispatchEvent(new Event("caderninho:theme"));
  }
  let initial = "dark";
  try {
    const saved = localStorage.getItem(key);
    if (saved === "light" || saved === "dark") {
      initial = saved;
    }
  } catch {
    // Preference storage is optional; the current page still supports switching.
  }
  applyTheme(initial);
  document.addEventListener("click", (event) => {
    if (
      !(
        event.target instanceof Element &&
        event.target.closest("[data-theme-toggle]")
      )
    ) {
      return;
    }
    const mode = root.dataset.mode === "dark" ? "light" : "dark";
    applyTheme(mode);
    try {
      localStorage.setItem(key, mode);
    } catch {
      // Private/blocked storage must not prevent the visual change.
    }
  });
  window.addEventListener("storage", (event) => {
    if (
      event.key === key &&
      (event.newValue === "light" || event.newValue === "dark")
    ) {
      applyTheme(event.newValue);
    }
  });
})();
