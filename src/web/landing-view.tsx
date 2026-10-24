import { LayerCard, Meter } from "@cloudflare/kumo";

import { Document } from "./document";
import { McpStaticFlow } from "./mcp-steps";
import { ThemeToggle } from "./theme-toggle";
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
          <link
            href="/landing.css"
            rel="stylesheet"
          />
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
            <ThemeToggle />
            <a href="/demo?month=2026-10">Demo</a>
            <a
              className="nav-secondary"
              href="#desempenho"
            >
              Desempenho
            </a>
            <a
              className="nav-secondary"
              href="#free-tier"
            >
              Free tier
            </a>
            <a
              className="nav-secondary"
              href="https://github.com/DanielSuhett/caderninho"
            >
              Código
            </a>
            {!publicSite && (
              <a
                aria-label="Entrar nesta instância"
                href="/account"
              >
                Entrar
              </a>
            )}
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
              <UiLink
                href="/demo?month=2026-10"
                size="lg"
                variant="secondary"
              >
                Explorar demonstração
              </UiLink>
            </div>
            <p className="note">
              Software gratuito. Cloudflare e Pluggy têm limites e custos
              próprios.
            </p>
          </section>
          <section
            aria-labelledby="mcp-title"
            className="mcp-explanation"
            id="como-funciona"
          >
            <div className="mcp-intro">
              <h2 id="mcp-title">Uma consulta ao histórico, por dentro.</h2>
              <p>
                Da sua pergunta aos dados que ajudam seu assistente a responder.
              </p>
            </div>
            <p className="mcp-example">
              “Quanto gastei este mês?” <span>Exemplo ilustrativo</span>
            </p>
            <div id="mcp-flow">
              <McpStaticFlow />
            </div>
            <p className="mcp-preparation">
              A autorização do cliente e a sincronização pela Pluggy acontecem
              antes. Cada consulta usa a cópia no D1, com a data e a cobertura
              disponíveis. A resposta de IA fica a cargo do cliente que você
              escolher.
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
              <p className="quota-sources">
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
      <script
        src="/landing.js"
        type="module"
      />
    </Document>
  );
}
