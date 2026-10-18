import type { AccountBrowser } from "./account.types.ts";

export const accountBrowser: AccountBrowser = {
  step() {
    const value = new URLSearchParams(location.search).get("step");
    if (value === null) {
      return undefined;
    }
    return Math.min(2, Math.max(1, Math.trunc(Number(value)) || 1));
  },
  selectStep(step) {
    history.replaceState(null, "", `/account?step=${step}`);
  },
  visible: () => !document.hidden,
  captureFocus() {
    const opener = document.activeElement;
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
      }
    };
  },
  copy: (value) => navigator.clipboard.writeText(value),
  login: () => location.assign("/account/login"),
};
