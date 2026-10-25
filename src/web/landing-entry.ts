import { tryCatch } from "../shared";

const reduced = matchMedia("(prefers-reduced-motion: reduce)");
for (const id of ["mcp-flow", "landing-rule", "landing-performance"]) {
  const explanation = document.getElementById(id);
  if (!explanation) {
    continue;
  }
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
      if (id === "mcp-flow") {
        data.mountMcpFlow(explanation);
      } else if (id === "landing-performance") {
        data.mountLandingPerformance(explanation);
      } else {
        data.mountLandingRule(explanation);
      }
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
        entry.target.classList.add("landing-revealed");
      }
    },
    { threshold: 0.05 },
  );
  for (const section of document.querySelectorAll(
    "main > section:not(.hero) h2, .section-intro > p, .rule-stage, .freedom-list > div, .connection-guide > li, .cost-surface, .faq-list > details, .install-section",
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
