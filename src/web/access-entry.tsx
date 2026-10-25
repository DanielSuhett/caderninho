import { ClipboardText } from "@cloudflare/kumo/components/clipboard-text";
import { TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { createRoot } from "react-dom/client";

import { UiButton } from "./ui";

const accessKeyPattern = /^cad_[a-f0-9]{64}$/;

export function GeneratedAccess({
  accessKey,
  csrf,
  target,
}: {
  accessKey: string;
  csrf: string;
  target: string;
}) {
  return (
    <div className="access-form">
      <p>Copie sua chave para o gerenciador de senhas antes de continuar.</p>
      <ClipboardText
        labels={{ copyAction: "Copiar chave de acesso" }}
        text={`${accessKey.slice(0, 12)}…${accessKey.slice(-6)}`}
        textToCopy={accessKey}
        tooltip={{
          copiedText: "Chave copiada.",
          text: "Copiar chave de acesso",
        }}
      />
      <form
        action="/account/login"
        className="access-form"
        method="post"
      >
        <input
          name="csrf"
          type="hidden"
          value={csrf}
        />
        <input
          name="returnTo"
          type="hidden"
          value={target}
        />
        <input
          name="password"
          type="hidden"
          value={accessKey}
        />
        <UiButton
          size="lg"
          variant="primary"
        >
          {target.startsWith("/authorize?")
            ? "Continuar autorização"
            : "Começar"}
        </UiButton>
      </form>
    </div>
  );
}

function mountGeneratedAccess() {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const accessKey = fragment.get("access_key");
  if (accessKey !== null) {
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
  }
  const root = document.getElementById("generated-access");
  const csrf = root?.getAttribute("data-csrf");
  const target = root?.getAttribute("data-target");
  if (
    !(root && csrf && target && accessKey && accessKeyPattern.test(accessKey))
  ) {
    return;
  }
  createRoot(root).render(
    <TooltipProvider>
      <GeneratedAccess
        accessKey={accessKey}
        csrf={csrf}
        target={target}
      />
    </TooltipProvider>,
  );
}

mountGeneratedAccess();
