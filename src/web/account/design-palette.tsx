import { Button } from "@cloudflare/kumo/components/button";
import { Grid } from "@cloudflare/kumo/components/grid";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Popover } from "@cloudflare/kumo/components/popover";
import { Text } from "@cloudflare/kumo/components/text";

import { colorTokens } from "../design-tokens";

export function DesignPalette() {
  return (
    <>
      <Text>
        Fundo, superfícies e contornos têm papéis equivalentes nos dois temas.
        Alterne o tema para comparar os mesmos componentes.
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
            <span
              aria-hidden
              style={{ backgroundColor: value }}
            />
            <Text bold>{name}</Text>
            <code>{value}</code>
          </div>
        ))}
      </Grid>
      <div className="design-surface-canvas">
        <LayerCard className="design-surface-card">
          <Text bold>Superfície de conteúdo</Text>
          <Text variant="secondary">
            Fundo neutro, contorno discreto e sombra curta. Painéis flutuantes
            usam mais elevação.
          </Text>
          <Popover>
            <Popover.Trigger render={<Button variant="secondary" />}>
              Ver painel flutuante
            </Popover.Trigger>
            <Popover.Content>
              <Popover.Title>Mais próximo de você</Popover.Title>
              <Text>Mesma superfície, com sombra de sobreposição.</Text>
            </Popover.Content>
          </Popover>
        </LayerCard>
      </div>
      <Text variant="secondary">
        Layouts usam intervalos de 4, 8, 12, 16, 24 e 32 px. Raios, sombras e
        foco seguem a escala compartilhada, sem molduras adicionais.
      </Text>
    </>
  );
}
