import { createRoot } from "react-dom/client";

import { AccountView } from "./account";

import "./account.css";
import "./account/audit.css";
import "./account/design-system.css";

function Account() {
  return <AccountView />;
}
const root = document.getElementById("account-root");
if (root) {
  createRoot(root).render(<Account />);
}
