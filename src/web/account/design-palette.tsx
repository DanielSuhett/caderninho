import { Grid, Text } from "@cloudflare/kumo";

import { colorTokens } from "../design-tokens";

export function DesignPalette() {
  return (
    <>
      <Text>
        Inter local, conteúdo de 16 px, metadados de 14 px e títulos em sentence
        case. Superfícies escuras e estados vêm do Kumo.
      </Text>
      <Grid
        gap="sm"
        variant="3up"
      >
        {Object.entries(colorTokens).map(([name, value]) => (
          <div
            className="design-token"
            data-token={name}
            key={name}
          >
            <span aria-hidden />
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
