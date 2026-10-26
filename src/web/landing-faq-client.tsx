import { createRoot } from "react-dom/client";

import { LandingFaq } from "./landing-faq";

export function mountLandingFaq(element: HTMLElement) {
  const opened = [
    ...element.querySelectorAll<HTMLDetailsElement>("details[open]"),
  ].map((item) => item.dataset.question ?? "");
  createRoot(element).render(
    <LandingFaq
      interactive
      opened={opened}
    />,
  );
}
