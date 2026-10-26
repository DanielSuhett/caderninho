// Product layout aliases; components use Kumo tokens directly.
export const colorTokens = {
  accent: "var(--text-color-kumo-link)",
  control: "var(--color-kumo-control)",
  focus: "var(--color-kumo-focus)",
  hairline: "var(--color-kumo-hairline)",
  line: "var(--color-kumo-line)",
  muted: "var(--text-color-kumo-subtle)",
  page: "var(--color-kumo-canvas)",
  "success-text": "var(--text-color-kumo-success)",
  surface: "var(--color-kumo-base)",
  "surface-hover": "var(--color-kumo-tint)",
  "surface-raised": "var(--color-kumo-elevated)",
  "surface-recessed": "var(--color-kumo-recessed)",
  text: "var(--text-color-kumo-default)",
} as const;
