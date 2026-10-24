import { tryCatch } from "../shared";

const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const explanation = document.getElementById("mcp-flow");
if (explanation) {
  const load = new IntersectionObserver(
    async ([entry]) => {
      if (!entry?.isIntersecting) {
        return;
      }
      load.disconnect();
      const { data, error } = await tryCatch(() => import("./mcp-flow"));
      // Optional enhancement: a failed chunk leaves the static explanation intact.
      if (error) {
        return;
      }
      data.mountMcpFlow(explanation);
    },
    { rootMargin: "240px" },
  );
  load.observe(explanation);
}

// Content is visible by default. Reveal once without gating links or reading.
if (!reduced.matches) {
  const reveal = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }
        reveal.unobserve(entry.target);
        if (reduced.matches) {
          continue;
        }
        entry.target.animate(
          [
            { opacity: 0.75, transform: "translateY(8px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 280, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
        );
      }
    },
    { threshold: 0.05 },
  );
  for (const section of document.querySelectorAll(
    "main > section:not(.hero)",
  )) {
    reveal.observe(section);
  }
  reduced.addEventListener("change", () => {
    if (!reduced.matches) {
      return;
    }
    reveal.disconnect();
    for (const animation of document.getAnimations()) {
      animation.cancel();
    }
  });
}
