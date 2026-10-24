import { LayerCard, Meter } from "@cloudflare/kumo";

import { Document } from "./document";
import { UiLink } from "./ui";

const responseTiming = {
  assumedPageMs: 350,
  measuredMcpMs: 87,
  pageSize: 500,
  transactions: 100_000,
};
const pageCount = Math.ceil(
  responseTiming.transactions / responseTiming.pageSize,
);
const estimatedDirectMs = pageCount * responseTiming.assumedPageMs;
const estimatedSpeedup =
  Math.round(estimatedDirectMs / responseTiming.measuredMcpMs / 100) * 100;

const projectionDays = 30;
const quotaCount = new Intl.NumberFormat("pt-BR");
const quotaPercent = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 3,
  style: "percent",
});
const quotaServices = [
  {
    id: "d1",
    metrics: [
      {
        dailyQuota: 5_000_000,
        dailyUse: 19_927,
        id: "d1-reads",
        label: "Leituras",
      },
      {
        dailyQuota: 100_000,
        dailyUse: 501,
        id: "d1-writes",
        label: "Escritas",
      },
    ],
    name: "D1",
    source: "https://developers.cloudflare.com/d1/platform/pricing/",
    unit: "linhas",
  },
  {
    id: "kv",
    metrics: [
      { dailyQuota: 100_000, dailyUse: 124, id: "kv-reads", label: "Leituras" },
      { dailyQuota: 1000, dailyUse: 12, id: "kv-writes", label: "Escritas" },
    ],
    name: "Workers KV",
    source: "https://developers.cloudflare.com/kv/platform/pricing/",
    unit: "chaves",
  },
];

export function landingPage({
  publicSite = false,
}: {
  publicSite?: boolean;
} = {}) {
  return (
    <Document
      head={
        <>
          <meta
            content="Seus dados financeiros na sua Cloudflare, disponíveis no seu cliente MCP."
            name="description"
          />
          {!!publicSite && (
            <>
              <link
                href="https://usecaderninho.com/"
                rel="canonical"
              />
              <meta
                content="website"
                property="og:type"
              />
              <meta
                content="https://usecaderninho.com/"
                property="og:url"
              />
              <meta
                content="Caderninho · MCP financeiro pessoal"
                property="og:title"
              />
              <meta
                content="Seus dados financeiros na sua Cloudflare, disponíveis no seu cliente MCP."
                property="og:description"
              />
            </>
          )}
          <style>{`
          .shell {
            max-width: 1120px;
            margin: auto;
            padding: 0 32px;
          }
          header,
          nav,
          .actions,
          footer {
            display: flex;
            align-items: center;
            gap: 24px;
          }
          header {
            justify-content: space-between;
            min-height: 104px;
          }
          .brand {
            font-size: 14px;
            font-weight: 500;

            text-decoration: none;
          }
          nav a,
          footer a,
          .skip {
            display: inline-flex;
            align-items: center;
            min-height: 44px;
          }
          nav,
          footer {
            font-size: 14px;
          }
          .skip {
            position: absolute;
            left: 24px;
            top: -100px;
            padding: 8px 16px;
            background: var(--surface);
          }
          .skip:focus {
            top: 12px;
          }
          h1,
          h2,
          h3,
          p {
            margin: 0;
          }
          h1 {
            font-size: clamp(32px, 5vw, 56px);
            line-height: 1.02;

            font-weight: 600;
            margin: 0 auto 28px;
            text-wrap: balance;
          }
          h2 {
            font-size: clamp(24px, 3.3vw, 32px);
            line-height: 1.13;

            font-weight: 500;
          }
          h3 {
            font-size: 16px;
            font-weight: 500;
            margin-bottom: 8px;
          }
          p {
            max-width: 65ch;
          }
          .hero {
            text-align: center;
            padding: 64px 0 72px;
          }
          .intro {
            font-size: 14px;
            color: var(--muted);
            max-width: 660px;
            margin: auto;
            text-wrap: balance;
          }
          .actions {
            justify-content: center;
            flex-wrap: wrap;
            margin-top: 30px;
          }
          .note {
            color: var(--muted);
            font-size: 14px;
            margin: 18px auto 0;
          }
          .install,
          .performance,
          .free-tier,
          .faq {
            border-top: 1px solid var(--line);
            padding: 48px 0;
          }
          .install {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 64px;
          }
          .install p {
            color: var(--muted);
            margin-top: 20px;
          }
          ol {
            list-style: decimal;
            padding-left: 24px;
            margin: 0;
          }
          li {
            padding: 0 0 24px 8px;
          }
          li:last-child {
            padding-bottom: 0;
          }
          .install li p {
            margin-top: 0;
          }
          .free-tier {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 32px 64px;
          }
          .performance {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            gap: 32px 64px;
          }
          .performance-copy > p {
            margin-top: 20px;
            color: var(--muted);
          }
          .response-timing {
            margin-top: 28px;
          }
          .response-timing strong {
            display: block;
            font-size: 14px;
            line-height: 1.1;
            font-weight: 600;

            font-variant-numeric: tabular-nums;
          }
          .response-timing span {
            display: block;
            margin-top: 8px;
            font-size: 14px;
            color: var(--muted);
          }
          .response-comparison {
            min-width: 0;
            margin: 0;
            padding: 24px;

          }
          .response-comparison figcaption {
            margin-bottom: 24px;
            font-size: 14px;
            font-weight: 500;
            text-wrap: balance;
          }
          .response-chart-note {
            margin: -12px 0 24px;
            font-size: 14px;
            color: var(--muted);
          }
          .response-axis {
            display: flex;
            justify-content: space-between;
            margin-top: 24px;
            padding-top: 12px;
            border-top: 1px solid var(--line);
            font-size: 14px;
            font-variant-numeric: tabular-nums;
            color: var(--muted);
          }
          .response-sample > p {
            font-size: 14px;
            color: var(--muted);
          }
          .response-sample + .response-sample {
            margin-top: 24px;
            padding-top: 24px;
            border-top: 1px solid var(--line);
          }
          .response-method {
            grid-column: 1 / -1;
            max-width: none;
            padding-top: 16px;
            border-top: 1px solid var(--line);
            font-size: 14px;
            color: var(--muted);
          }
          .response-method a {
            color: var(--accent);
          }
          .free-tier-copy > p {
            margin-top: 20px;
            color: var(--muted);
          }
          .free-tier-copy .eyebrow {
            margin: 0 0 12px;
            color: var(--accent);
            font-size: 14px;
            font-weight: 600;
          }
          .cpu-chart {
            min-width: 0;
            margin: 0;
            padding: 24px;

          }
          .cpu-chart figcaption {
            margin-bottom: 28px;
            font-size: 14px;
            color: var(--muted);
          }
          .cpu-sample + .cpu-sample {
            margin-top: 24px;
          }
          .cpu-label {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 4px 16px;
            margin-bottom: 10px;
            font-size: 14px;
          }
          .cpu-value {
            font-size: 14px;
            font-weight: 600;
            font-variant-numeric: tabular-nums;
          }
          .quota-consumption { background: var(--color-orange-500); }
          .cpu-scale {
            display: flex;
            justify-content: space-between;
            margin-top: 12px;
            font-size: 14px;
            font-variant-numeric: tabular-nums;
            color: var(--muted);
          }
          .cpu-reference {
            padding-top: 20px;
            margin-top: 20px;
            border-top: 1px solid var(--line);
            font-size: 14px;
          }
          .cpu-reference a {
            color: var(--accent);
          }
          .cpu-method {
            grid-column: 1 / -1;
            margin: 0;
            padding-top: 16px;
            border-top: 1px solid var(--line);
            font-size: 14px;
            color: var(--muted);
          }
          .cpu-method strong {
            color: var(--text);
            font-weight: 500;
          }
          .quota-heading,
          .quota-method {
            grid-column: 1 / -1;
          }
          .quota-heading > p {
            margin-top: 12px;
            color: var(--muted);
          }
          .measurement-notes {
            grid-column: 1 / -1;
            padding: 0;
            border: 0;
          }
          .measurement-notes > summary {
            min-height: 44px;
            font-size: 14px;
            color: var(--accent);
          }
          .measurement-notes p {
            font-size: 14px;
          }
          .measurement-notes a {
            color: var(--accent);
          }
          .quota-count {
            margin-top: 8px;
            font-size: 14px;
            font-variant-numeric: tabular-nums;
            color: var(--muted);
          }
          .quota-method {
            font-size: 14px;
            color: var(--muted);
          }
          details {
            border-bottom: 1px solid var(--line);
            padding: 16px 0;
          }
          summary {
            cursor: pointer;
            min-height: 48px;
            align-content: center;
            font-size: 14px;
            font-weight: 500;
          }
          details p {
            margin: 12px 0;
            color: var(--muted);
          }
          footer {
            flex-wrap: wrap;
            border-top: 1px solid var(--line);
            padding: 24px 0 40px;
            color: var(--muted);
          }
          footer p {
            margin-right: auto;
          }
          @media (max-width: 640px) {
            .shell {
              padding: 0 20px;
            }
            header {
              align-items: flex-start;
              flex-direction: column;
              gap: 8px;
              padding-top: 24px;
            }
            nav {
              flex-wrap: wrap;
              gap: 20px;
            }
            .hero {
              padding: 48px 0;
            }
            .intro {
              font-size: 14px;
            }
            .install,
            .performance,
            .free-tier {
              grid-template-columns: 1fr;
              gap: 32px;
            }
          }
        `}</style>
        </>
      }
      title="Caderninho · MCP financeiro pessoal"
    >
      <a
        className="skip"
        href="#conteudo"
      >
        Pular para o conteúdo
      </a>
      <div className="shell">
        <header>
          <a
            aria-label="Caderninho, início"
            className="brand"
            href="/"
          >
            Caderninho
          </a>
          <nav aria-label="Navegação principal">
            <a href="#desempenho">Desempenho</a>
            <a href="#free-tier">Free tier</a>
            <a href="https://github.com/DanielSuhett/caderninho">Código</a>
            {!publicSite && <a href="/account">Entrar nesta instância</a>}
          </nav>
        </header>
        <main id="conteudo">
          <section
            aria-labelledby="hero-title"
            className="hero"
          >
            <h1 id="hero-title">
              Seus dados financeiros.
              <br />
              No seu cliente MCP.
            </h1>
            <p className="intro">
              Sincronize seus bancos pela Pluggy e consulte seu histórico no
              cliente de IA que você escolher. O Caderninho roda na sua conta
              Cloudflare, com acesso controlado por você.
            </p>
            <div className="actions">
              <UiLink
                href="https://deploy.workers.cloudflare.com/?url=https://github.com/DanielSuhett/caderninho"
                size="lg"
                variant="primary"
              >
                Instalar na minha Cloudflare
              </UiLink>
              {!publicSite && <a href="/account">Abrir meu painel</a>}
            </div>
            <p className="note">
              Software gratuito. Cloudflare e Pluggy têm limites e custos
              próprios.
            </p>
          </section>
          <section
            aria-labelledby="install-title"
            className="install"
          >
            <div>
              <h2 id="install-title">Da sua conta ao seu assistente.</h2>
              <p>
                O painel acompanha a instalação, a conexão dos bancos e a
                primeira importação. As perguntas consultam a cópia
                sincronizada; confira a cobertura e a data dos dados antes de
                usar os totais.
              </p>
            </div>
            <ol>
              <li>
                <h3>Instale na sua Cloudflare</h3>
                <p>
                  Escolha uma senha e informe Client ID e Client Secret da
                  Pluggy no botão Cloudflare. Veja as instruções do README.
                </p>
              </li>
              <li>
                <h3>Conecte seus bancos</h3>
                <p>
                  Entre no painel com sua senha e importe as conexões do Meu
                  Pluggy.
                </p>
              </li>
              <li>
                <h3>Autorize seu cliente MCP</h3>
                <p>
                  Copie o endereço <code>/mcp</code> e conecte seu assistente
                  por OAuth.
                </p>
              </li>
            </ol>
          </section>
          <section
            aria-labelledby="performance-title"
            className="performance"
            id="desempenho"
          >
            <div className="performance-copy">
              <h2 id="performance-title">
                Uma pergunta. O total já vem pronto.
              </h2>
              <p>
                Depois de sincronizar, seu assistente consulta o histórico já
                importado. O Caderninho calcula os totais por moeda e devolve
                uma resposta compacta, sem buscar novas páginas na Pluggy a cada
                pergunta.
              </p>
              <div className="response-timing">
                <strong>≈{estimatedSpeedup}×</strong>
                <span>
                  mais rápido no cenário estimado de 100 mil transações
                </span>
              </div>
              <p>
                A consulta usa a última sincronização disponível. A resposta
                informa a data e a parcialidade dos dados.
              </p>
            </div>
            <LayerCard
              aria-describedby="response-method"
              className="response-comparison"
              render={<figure />}
            >
              <figcaption>
                “Qual é o total de débitos do meu histórico?”
              </figcaption>
              <p className="response-chart-note">
                Tempo até o total · escala linear · menor é melhor
              </p>
              <div className="response-sample response-local">
                <Meter
                  aria-valuetext={`${responseTiming.measuredMcpMs} milissegundos medidos; referência estimada de ${estimatedDirectMs} milissegundos`}
                  customValue={`${responseTiming.measuredMcpMs} ms`}
                  label="Caderninho · MCP local"
                  max={estimatedDirectMs}
                  min={0}
                  value={responseTiming.measuredMcpMs}
                />
                <p>
                  1 chamada MCP, depois de sincronizar. A barra fica próxima de
                  zero nesta escala.
                </p>
              </div>
              <div className="response-sample">
                <Meter
                  aria-valuetext={`${estimatedDirectMs / 1000} segundos estimados; limite da escala de comparação`}
                  customValue={`${estimatedDirectMs / 1000} s estimados`}
                  label="Busca direta na Pluggy"
                  max={estimatedDirectMs}
                  min={0}
                  value={estimatedDirectMs}
                />
                <p>
                  {pageCount} páginas sequenciais ×{" "}
                  {responseTiming.assumedPageMs} ms por página, para reler o
                  histórico inteiro.
                </p>
              </div>
              <div
                aria-hidden="true"
                className="response-axis"
              >
                <span>0 s</span>
                <span>{estimatedDirectMs / 2000} s</span>
                <span>{estimatedDirectMs / 1000} s</span>
              </div>
            </LayerCard>
            <details className="measurement-notes">
              <summary>Ver método e referências de desempenho</summary>
              <p
                className="response-method"
                id="response-method"
              >
                Estimativa: 200 páginas de 500 transações, sem paralelismo.
                Assumimos 350 ms por página a partir de uma leitura Pluggy de
                355 ms observada na Cloudflare em 19 out 2026 (UTC; amostra de
                uma leitura). Os 87 ms do Caderninho são a mediana de 20
                chamadas locais em workerd/D1 após cinco aquecimentos, com dados
                sintéticos; incluem OAuth, consulta e serialização. O
                multiplicador é uma projeção entre essas referências, não um
                teste simultâneo em produção. Exclui sincronização, rede do
                cliente e tempo do modelo de IA.{" "}
                <a href="https://v2.docs.pluggy.ai/en/reference/transaction/transactions-list-by-cursor">
                  Ver paginação da Pluggy
                </a>
                .
              </p>
            </details>
          </section>
          <section
            aria-labelledby="free-tier-title"
            className="free-tier"
            id="free-tier"
          >
            <div className="free-tier-copy">
              <p className="eyebrow">Cloudflare Free</p>
              <h2 id="free-tier-title">Feito para caber no free tier.</h2>
              <p>
                A sincronização trabalha em páginas pequenas. As barras mostram
                o tempo médio de CPU de duas páginas de importação, comparado à
                referência de 10 ms por etapa do Workflows Free.
              </p>
              <p>
                Na página de 500 transações, os ajustes reduziram a CPU local de
                84,0 para até 10,3 ms nos ensaios: cerca de 88% menos
                processamento.
              </p>
            </div>
            <LayerCard
              aria-describedby="cpu-method"
              className="cpu-chart"
              render={<figure />}
            >
              <figcaption>
                CPU time · benchmark local ·{" "}
                <time dateTime="2026-10-23">23 out 2026</time>
              </figcaption>
              <div className="cpu-sample">
                <Meter
                  aria-describedby="cpu-method cpu-reference"
                  aria-valuetext="7,9 milissegundos de CPU no benchmark local; escala de 0 a 10 milissegundos"
                  customValue="7,9 ms"
                  id="cpu-personal-label"
                  indicatorClassName="quota-consumption"
                  label="347 transações por página"
                  max={10}
                  min={0}
                  value={7.920_82}
                />
              </div>
              <div className="cpu-sample">
                <Meter
                  aria-describedby="cpu-method cpu-reference"
                  aria-valuetext="10,3 milissegundos de CPU no benchmark local, 103% da referência de 10 milissegundos"
                  customValue="10,3 ms · 103%"
                  id="cpu-full-label"
                  indicatorClassName="quota-consumption"
                  label="500 transações por página"
                  max={10}
                  min={0}
                  value={10}
                />
              </div>
              <div
                aria-hidden="true"
                className="cpu-scale"
              >
                <span>0 ms</span>
                <span>5 ms</span>
                <span>10 ms</span>
              </div>
              <p
                className="cpu-reference"
                id="cpu-reference"
              >
                Referência Free: <strong>10 ms de CPU por etapa.</strong> A
                página de 500 ultrapassou a referência no ensaio local. CPU em
                produção ainda em validação.
              </p>
            </LayerCard>
            <details className="measurement-notes">
              <summary>Ver método e limites de CPU</summary>
              <p
                className="cpu-method"
                id="cpu-method"
              >
                <strong>
                  Benchmark local, com validação em produção pendente.
                </strong>{" "}
                Maior média observada em ensaios de 50 execuções em Node 24,
                após cinco aquecimentos, com dados sintéticos. Inclui parse,
                validação e preparação da importação; exclui execução D1 e
                transporte HTTP. A página de 500 registros variou de 6,3 a 10,3
                ms; a barra satura em 100% da referência. Inclui os metadados de
                cartão e parcelas da main integrada. A CPU efetiva na Cloudflare
                ainda precisa ser medida para confirmar a operação no Free. As
                cotas da conta e os custos da Pluggy também se aplicam.
              </p>
              <p>
                <a href="https://developers.cloudflare.com/workflows/reference/limits/">
                  Limites oficiais do Cloudflare Workflows
                </a>
              </p>
            </details>
            <div className="quota-heading">
              <h3>Um mês de uso misto.</h3>
              <p>
                Projeção de {projectionDays} dias. Laranja = fração da cota
                usada, em escala linear de 0 a 100%. Consumos abaixo de 1%
                aparecem como barras quase vazias.
              </p>
            </div>
            {quotaServices.map((service) => (
              <LayerCard
                aria-describedby="quota-method quota-scenario"
                className="cpu-chart"
                key={service.id}
                render={<figure />}
              >
                <figcaption>
                  {service.name} · uso em {projectionDays} dias
                </figcaption>
                {service.metrics.map((metric) => {
                  const used = metric.dailyUse * projectionDays;
                  const quota = metric.dailyQuota * projectionDays;
                  const percentage = quotaPercent.format(used / quota);
                  const usedLabel = quotaCount.format(used);
                  const quotaLabel = quotaCount.format(quota);
                  return (
                    <div
                      className="cpu-sample"
                      key={metric.id}
                    >
                      <Meter
                        aria-describedby="quota-method quota-scenario"
                        aria-valuetext={`${percentage} da referência mensal equivalente; ${usedLabel} de ${quotaLabel} ${service.unit} em ${projectionDays} dias`}
                        customValue={percentage}
                        id={`${metric.id}-label`}
                        indicatorClassName="quota-consumption"
                        label={metric.label}
                        max={quota}
                        min={0}
                        value={used}
                      />
                      <p className="quota-count">
                        {usedLabel} de {quotaLabel} {service.unit}
                      </p>
                    </div>
                  );
                })}
                <div
                  aria-hidden="true"
                  className="cpu-scale"
                >
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </LayerCard>
            ))}
            <div className="quota-heading">
              <p>
                Referência mensal equivalente; os limites Free continuam
                diários.
              </p>
            </div>
            <details className="measurement-notes">
              <summary>Ver premissas e cotas de D1 e KV</summary>
              <p
                className="quota-method"
                id="quota-method"
              >
                <strong>Referência mensal equivalente:</strong> uso diário e
                cota diária multiplicados por {projectionDays}. As cotas Free do
                D1 e do KV renovam diariamente, são compartilhadas pela conta e
                não acumulam saldo entre dias. A CPU acima continua sendo medida
                por etapa, sem cota mensal de CPU neste comparativo.
              </p>
              <p
                className="quota-method"
                id="quota-scenario"
              >
                Cenário sintético: base fixa de 555 transações, 100 consultas
                MCP por dia, uma sincronização diária sem novidades e seis
                renovações OAuth, além das consultas auxiliares de status e
                metadados. Novas transações, novas autorizações e outras
                aplicações na conta aumentam o consumo. Projeção baseada na
                simulação de 22 out 2026.
              </p>
              <p>
                {quotaServices.map((service) => (
                  <a
                    href={service.source}
                    key={service.id}
                  >
                    Cotas oficiais do {service.name}{" "}
                  </a>
                ))}
              </p>
            </details>
          </section>
          <section
            aria-labelledby="faq-title"
            className="faq"
          >
            <h2 id="faq-title">Antes de instalar.</h2>
            <details>
              <summary>Onde ficam os dados e as credenciais?</summary>
              <p>
                Na sua Cloudflare. As credenciais Pluggy ficam nos secrets do
                seu Worker. O runtime usa essas credenciais para sincronizar. O
                criador do projeto não recebe acesso administrativo à sua conta.
              </p>
              <p>
                Os resultados consultados pelo MCP ficam disponíveis ao cliente
                e ao modelo que você escolher.
              </p>
            </details>
            <details>
              <summary>Qual cliente MCP posso usar?</summary>
              <p>
                Use um cliente com suporte a MCP remoto e OAuth. A
                compatibilidade precisa ser validada no cliente e na versão
                escolhidos.
              </p>
            </details>
            <details>
              <summary>A instalação automática já foi validada?</summary>
              <p>
                O primeiro deploy pelo botão em uma conta nova ainda está em
                validação. Confira a instalação no painel antes de conectar seus
                bancos.
              </p>
            </details>
          </section>
        </main>
        <footer>
          <p>
            Projeto pessoal de{" "}
            <a href="https://github.com/DanielSuhett">DanielSuhett</a>
          </p>
          <a href="https://github.com/DanielSuhett/caderninho">Repositório</a>
          <a href="https://github.com/DanielSuhett/caderninho#começar">
            Instruções de instalação
          </a>
        </footer>
      </div>
    </Document>
  );
}
