import { Grid, Text } from "@cloudflare/kumo";

import { colorTokens } from "../design-tokens";

export function DesignPalette() {
  return (
    <>
      <Text>
        Fonte do sistema, conteúdo de 14 px e títulos em sentence case. Cores e
        estados vêm do tema claro do Kumo.
      </Text>
      <Grid
        gap="sm"
        variant="3up"
      >
        {Object.entries(colorTokens).map(([name, value]) => (
          <div
            className="design-token"
            key={name}
          >
            <span
              aria-hidden
              style={{ background: `var(--${name})` }}
            />
            <Text bold>{name}</Text>
            <code>{value}</code>
          </div>
        ))}
      </Grid>
      <Text variant="secondary">
        Layouts usam intervalos de 4, 8, 12, 16, 24 e 32 px. Raios, sombras e
        foco pertencem aos componentes.
      </Text>
    </>
  );
}
