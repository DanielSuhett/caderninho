import { tryCatch } from "../shared/result";

const reduced = matchMedia("(prefers-reduced-motion: reduce)");
for (const id of [
  "mcp-flow",
  "landing-rule",
  "landing-performance",
  "landing-faq",
]) {
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
      if (id === "landing-faq") {
        const { data, error } = await tryCatch(
          () => import("./landing-faq-client"),
        );
        if (!error) {
          data.mountLandingFaq(explanation);
        }
        return;
      }
      if (id === "landing-performance") {
        const { data, error } = await tryCatch(
          () => import("./landing-performance-client"),
        );
        if (!error) {
          data.mountLandingPerformance(explanation);
        }
        return;
      }
      if (id === "landing-rule") {
        const { data, error } = await tryCatch(
          () => import("./landing-rule-client"),
        );
        if (!error) {
          data.mountLandingRule(explanation);
        }
        return;
      }
      const { data, error } = await tryCatch(() => import("./mcp-flow"));
      // A failed optional enhancement leaves the static explanation intact.
      if (!error) {
        data.mountMcpFlow(explanation);
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
    "main > section:not(.hero) h2, .section-intro > p, .rule-stage, .freedom-list > div, .connection-guide > li, .cost-surface, .faq-item, .install-section",
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
