import { LayerCard } from "@cloudflare/kumo/components/layer-card";

import { MoneyValue } from "../money-value";

export function DesignTypography() {
  return (
    <LayerCard className="typography-specimens">
      <section>
        <h3>Interface · Inter</h3>
        <p className="typography-caption">
          Títulos 28/20 px · corpo 16 px · metadados 14 px
        </p>
        <p className="typography-page-title">Visão geral</p>
        <p>
          Consulte suas contas, categorize transações e acompanhe o histórico.
        </p>
        <p className="typography-caption">
          Atualizado em 26 de outubro · São Paulo
        </p>
      </section>
      <section>
        <h3>Landing · Source Serif 4</h3>
        <p className="typography-caption">
          Títulos editoriais · 40–64 px no hero · 30–40 px nas seções
        </p>
        <p className="typography-display">Suas finanças, na sua IA.</p>
        <p>
          Texto de apoio, navegação, botões e prévias do sistema continuam em
          Inter.
        </p>
      </section>
      <section>
        <h3>Valores · Inter tabular</h3>
        <p className="typography-caption">
          Algarismos alinhados · moeda explícita · sinal preservado
        </p>
        <dl className="typography-money">
          <div>
            <dt>Saldo</dt>
            <dd>
              <MoneyValue value="1.234.567,89 BRL" />
            </dd>
          </div>
          <div>
            <dt>Saída</dt>
            <dd>
              <MoneyValue value="−150,00 BRL" />
            </dd>
          </div>
          <div>
            <dt>Zero</dt>
            <dd>
              <MoneyValue value="0,00 BRL" />
            </dd>
          </div>
          <div>
            <dt>Sem cobertura</dt>
            <dd>Indisponível</dd>
          </div>
        </dl>
      </section>
      <section>
        <h3>Código · monoespaçada do sistema</h3>
        <p className="typography-caption">
          URLs, chaves, comandos e prompts · nunca descrições ou valores
          financeiros
        </p>
        <code>https://sua-instancia.workers.dev/mcp</code>
      </section>
      <p className="typography-caption">
        Peso máximo 600, entrelinha 1,5 no corpo e até 65 caracteres por linha.
        Foco visível, contraste nos dois temas e zoom de 200% fazem parte da
        revisão.
      </p>
    </LayerCard>
  );
}
