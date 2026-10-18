import { useEffect, useState } from "react";

import { createAccountController } from "./account-controller.ts";
import { pollingDelay } from "./account-model.ts";

export function useAccount() {
  const [controller] = useState(createAccountController);
  const [state, setState] = useState(controller.getSnapshot);
  useEffect(() => controller.start(setState), [controller]);

  const delay = pollingDelay(state);
  useEffect(() => {
    if (delay === undefined) {
      return;
    }
    const tick = () => {
      void controller.actions.refresh();
    };
    const timer = setInterval(tick, delay);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [controller, delay]);

  return { ...state, actions: controller.actions };
}
