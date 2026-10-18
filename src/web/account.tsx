import { createRoot } from "react-dom/client";

import { AccountView } from "#web/account/account-view.tsx";
import { useAccount } from "#web/account/use-account.ts";

import "#web/account.css";

function Account() {
  return <AccountView {...useAccount()} />;
}
const root = document.getElementById("account-root");
if (root) createRoot(root).render(<Account />);
