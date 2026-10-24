import { MoonIcon, SunIcon } from "@phosphor-icons/react";

import { UiButton } from "./ui";

export function ThemeToggle() {
  return (
    <UiButton
      aria-label="Alternar tema claro e escuro"
      className="theme-toggle"
      data-theme-toggle=""
      shape="square"
      type="button"
      variant="ghost"
    >
      <span className="theme-target-light">
        <SunIcon
          aria-hidden
          size={20}
        />
        <span className="sr-only">Ativar tema claro</span>
      </span>
      <span className="theme-target-dark">
        <MoonIcon
          aria-hidden
          size={20}
        />
        <span className="sr-only">Ativar tema escuro</span>
      </span>
    </UiButton>
  );
}
