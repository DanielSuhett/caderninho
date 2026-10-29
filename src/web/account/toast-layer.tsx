import {
  createKumoToastManager,
  Toasty,
} from "@cloudflare/kumo/components/toast";
import { useEffect } from "react";

import { connectToaster } from "./notify";

const manager = createKumoToastManager();

export function ToastLayer() {
  useEffect(() => connectToaster((notice) => manager.add(notice)), []);
  return <Toasty toastManager={manager}>{null}</Toasty>;
}
