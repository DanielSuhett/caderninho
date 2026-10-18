import { createRoot } from "react-dom/client";

import { AccountView, useAccount } from "./account/index";

import "./account.css";

function Account() {
  return <AccountView {...useAccount()} />;
}
const root = document.getElementById("account-root");
if (root) {
  createRoot(root).render(<Account />);
}
