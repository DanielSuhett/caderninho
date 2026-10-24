import { useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  document.addEventListener("caderninho:theme", listener);
  return () => document.removeEventListener("caderninho:theme", listener);
}
function currentTheme() {
  return document.documentElement.dataset.mode === "light" ? "light" : "dark";
}
function serverTheme() {
  return "dark";
}
export function useTheme() {
  return useSyncExternalStore(subscribe, currentTheme, serverTheme);
}
