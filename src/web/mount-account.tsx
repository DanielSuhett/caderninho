import { createRoot } from "react-dom/client";

import { AccountView } from "./account";

import "./account.css";

function Account() {
  return <AccountView />;
}
const root = document.getElementById("account-root");
if (root) {
  createRoot(root).render(<Account />);
}
