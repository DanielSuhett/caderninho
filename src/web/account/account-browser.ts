import type { AccountBrowser } from "./account.types";

export const accountBrowser: AccountBrowser = {
  captureFocus() {
    const { activeElement: opener } = document;
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
      }
    };
  },
  copy: (value) => navigator.clipboard.writeText(value),
  login: () => location.assign("/account/login"),
  selectStep(step) {
    history.replaceState(null, "", `/account?step=${step}`);
  },
  step() {
    const value = new URLSearchParams(location.search).get("step");
    if (value === null) {
      return;
    }
    return Math.min(2, Math.max(1, Math.trunc(Number(value)) || 1));
  },
  visible: () => !document.hidden,
};
