import { colorTokens, shadowTokens } from "../design-tokens";
import { UiButton, UiField } from "../ui";

const groups = [
  {
    title: "Neutros e superfícies",
    tokens: [
      "page",
      "surface",
      "surface-raised",
      "surface-hover",
      "surface-pressed",
      "text",
      "muted",
      "line",
      "control-border",
    ],
  },
  {
    title: "Ação, seleção e indisponibilidade",
    tokens: [
      "accent",
      "accent-hover",
      "accent-pressed",
      "on-accent",
      "selected-bg",
      "selected-text",
      "disabled-bg",
      "disabled-text",
    ],
  },
  {
    title: "Sucesso",
    tokens: ["success-text", "success-bg", "success-border"],
  },
  {
    title: "Atenção",
    tokens: ["warning-text", "warning-bg", "warning-border"],
  },
  {
    title: "Erro e ação destrutiva",
    tokens: [
      "error-text",
      "error-bg",
      "error-border",
      "danger-hover",
      "danger-pressed",
    ],
  },
  { title: "Informação", tokens: ["info-text", "info-bg", "info-border"] },
  {
    title: "Séries de dados",
    tokens: ["chart-1", "chart-2", "chart-3", "chart-4"],
  },
] satisfies Array<{ title: string; tokens: Array<keyof typeof colorTokens> }>;

const feedback = [
  {
    message:
      "Importação finalizada. Última atualização disponível junto aos dados.",
    title: "Concluída",
    tone: "success",
  },
  {
    message: "A importação foi solicitada e aguarda execução.",
    title: "Na fila",
    tone: "warning",
  },
  {
    message:
      "A importação foi interrompida. Os registros já confirmados foram preservados.",
    title: "Falhou",
    tone: "error",
  },
  {
    message:
      "Novos registros estão sendo consultados. Acompanhe a rodada em Sincronizações.",
    title: "Em andamento",
    tone: "info",
  },
] as const;

export function DesignPalette({ demonstrate }: { demonstrate: () => void }) {
  return (
    <>
      <section aria-labelledby="design-palette">
        <h2 id="design-palette">Paleta e semântica</h2>
        <p>
          Preto, neutros e laranja formam a identidade. As cores auxiliares
          comunicam estados; o rótulo continua obrigatório. Exemplos fictícios.
        </p>
        <div className="design-feedback-grid">
          {feedback.map(({ tone, title, message }) => (
            <div
              className="notice"
              data-tone={tone}
              key={tone}
            >
              <strong>{title}</strong>
              <p>{message}</p>
              <code>--{tone}-text / bg / border</code>
            </div>
          ))}
        </div>
        <details>
          <summary>Consultar todas as cores e valores</summary>
          {groups.map(({ title, tokens }) => (
            <div
              className="design-color-group"
              key={title}
            >
              <h3>{title}</h3>
              <div className="design-swatches">
                {tokens.map((token) => (
                  <div key={token}>
                    <span
                      aria-hidden="true"
                      style={{ background: `var(--${token})` }}
                    />
                    <code>--{token}</code>
                    <small>{colorTokens[token]}</small>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </details>
      </section>
      <section aria-labelledby="design-depth">
        <h2 id="design-depth">Superfícies e profundidade</h2>
        <p>
          A luminosidade separa camadas no tema escuro. A sombra reforça essa
          diferença, sem criar novos cards para cada informação.
        </p>
        <div className="design-depth-grid">
          {Object.entries(shadowTokens).map(([token, value]) => (
            <div
              className={`design-depth ${token}`}
              key={token}
              style={{ boxShadow: value }}
            >
              <strong>
                {token === "shadow-flat"
                  ? "Base"
                  : token.replace("shadow-", "")}
              </strong>
              <code>--{token}</code>
              <small>{value}</small>
            </div>
          ))}
        </div>
        <p className="muted">
          Base: tabelas e listas. Baixa: filtros e grupos. Elevada: dicas sobre
          o conteúdo. Pública: landing e login.
        </p>
      </section>
      <section aria-labelledby="design-controls">
        <h2 id="design-controls">Estados de interação</h2>
        <p>
          Controles reais com estados fixados para comparação. Passe o mouse,
          pressione ou use Tab nos demais exemplos para testar a interação.
        </p>
        <div className="design-state-grid">
          {[
            { label: "Normal", state: "normal" },
            { label: "Hover", state: "hover" },
            { label: "Pressionado", state: "pressed" },
          ].map(({ label, state }) => (
            <div key={state}>
              <small>{label}</small>
              <UiButton
                data-preview-state={state}
                onClick={demonstrate}
                type="button"
              >
                Primário
              </UiButton>
              <UiButton
                data-preview-state={state}
                onClick={demonstrate}
                type="button"
                variant="secondary"
              >
                Secundário
              </UiButton>
              <UiButton
                data-preview-state={state}
                onClick={demonstrate}
                tone="danger"
                type="button"
              >
                Revogar · exemplo
              </UiButton>
            </div>
          ))}
          <div>
            <small>Desabilitado</small>
            <UiButton
              disabled
              type="button"
            >
              Primário
            </UiButton>
            <UiButton
              disabled
              type="button"
              variant="secondary"
            >
              Secundário
            </UiButton>
            <UiButton
              disabled
              tone="danger"
              type="button"
            >
              Revogar · exemplo
            </UiButton>
          </div>
        </div>
        <div className="design-field-grid">
          <UiField
            label="Campo normal · exemplo"
            placeholder="Identifique o titular"
          />
          <div>
            <UiField
              aria-describedby="design-invalid-hint"
              aria-invalid
              defaultValue=""
              label="Campo com erro · exemplo"
            />
            <p
              className="design-field-error"
              id="design-invalid-hint"
            >
              Informe um nome para continuar. Exemplo de validação.
            </p>
          </div>
          <UiField
            disabled
            label="Campo indisponível · exemplo"
            value="Somente após conectar"
          />
        </div>
      </section>
      <section aria-labelledby="design-charts">
        <h2 id="design-charts">Cores para dados</h2>
        <p>
          Uma série usa uma cor. Séries distintas ganham rótulos e valores
          diretos; a cor sozinha não identifica titular, banco ou modelo.
        </p>
        <div className="design-chart-examples">
          {[24, 18, 12, 6].map((value, index) => (
            <div key={value}>
              <span>Série {index + 1} · exemplo</span>
              <meter
                aria-label={`Série ${index + 1}: ${value} chamadas fictícias`}
                className={`chart-${index + 1}`}
                max={24}
                value={value}
              />
              <strong>{value} chamadas</strong>
            </div>
          ))}
        </div>
        <p className="muted">
          Não usar verde para qualquer entrada financeira nem vermelho para
          qualquer saída. Esses valores exigem contexto; sucesso e falha
          descrevem operações.
        </p>
      </section>
    </>
  );
}
