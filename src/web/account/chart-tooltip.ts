import type { Chart } from "@cloudflare/kumo/components/chart";

// HTML can resolve the same CSS theme tokens as Kumo's other floating surfaces.
// A solid surface and an immediate pointer response keep dense charts readable.
export const chartTooltip = {
  backgroundColor: "var(--surface-raised)",
  borderColor: "var(--line)",
  borderWidth: 1,
  confine: true,
  extraCssText:
    "max-width:calc(100% - 16px);white-space:normal;line-height:1.5;box-shadow:var(--shadow-md)",
  hideDelay: 80,
  padding: [10, 12],
  renderMode: "html",
  textStyle: {
    color: "var(--text)",
    fontFamily: "Inter, sans-serif",
    fontSize: 14,
  },
  transitionDuration: 0,
} satisfies Parameters<typeof Chart>[0]["options"]["tooltip"];
