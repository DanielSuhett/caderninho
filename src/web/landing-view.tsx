import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { ArrowRightIcon, CheckIcon } from "@phosphor-icons/react";

import { Document } from "./document";
import { LandingPerformance } from "./landing-performance";
import { LandingRuleExample } from "./landing-rule-example";
import { McpStaticFlow } from "./mcp-steps";
import { ThemeToggle } from "./theme-toggle";
import { UiLink } from "./ui";

const repository = "https://github.com/DanielSuhett/caderninho";
const installUrl = `https://deploy.workers.cloudflare.com/?url=${repository}`;
const count = new Intl.NumberFormat("pt-BR");
const percent = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 3,
  style: "percent",
});
const quotas = [
  { name: "D1 · linhas lidas", quota: 5_000_000, used: 19_927 },
  { name: "D1 · linhas escritas", quota: 100_000, used: 501 },
  { name: "KV · chaves lidas", quota: 100_000, used: 124 },
  { name: "KV · chaves escritas", quota: 1000, used: 12 },
];

function InstallLink() {
  return (
    <UiLink
      href={installUrl}
      size="lg"
      variant="primary"
    >
      Instalar na minha Cloudflare
    </UiLink>
  );
}

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
            content="Seus bancos na sua Cloudflare, conectados a várias IAs por MCP. Consultas agregadas e uma arquitetura pensada para os planos gratuitos."
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
                content="Caderninho · Seus bancos. Sua escolha de IA."
                property="og:title"
              />
              <meta
                content="Vários bancos, uma base sua e vários assistentes conectados por MCP."
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
      title="Caderninho · Seus bancos. Sua escolha de IA."
    >
      <a
        className="skip"
        href="#conteudo"
      >
        Pular para o conteúdo
      </a>
      <div className="landing-shell">
        <header className="landing-header">
          <a
            aria-label="Caderninho, início"
            className="brand"
            href="/"
          >
            Caderninho
          </a>
          <nav aria-label="Navegação principal">
            <a href="#conectar">Guia MCP</a>
            <a
              className="nav-secondary"
              href="#regras"
            >
              Regras
            </a>
            <a
              className="nav-secondary"
              href="#free-tier"
            >
              Custos
            </a>
            <a href="/demo?month=2026-10">Demo</a>
            <a
              className="nav-secondary"
              href="#desempenho"
            >
              Performance
            </a>
            <ThemeToggle />
            {!publicSite && (
              <a
                className="nav-entry"
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
              Seus bancos.
              <br />
              Sua escolha de IA.
            </h1>
            <p className="hero-description">
              Seus bancos na sua Cloudflare. Converse com seus dados no ChatGPT,
              no Claude ou em outro cliente MCP compatível.
            </p>
            <div className="hero-actions">
              <InstallLink />
              <UiLink
                href="#desempenho"
                size="lg"
                variant="secondary"
              >
                Ver a diferença
              </UiLink>
            </div>
            <p className="hero-note">
              Código aberto. Pensado para rodar a custo zero nos planos
              gratuitos.
            </p>
            <figure
              aria-labelledby="network-title"
              className="network-figure"
              id="produto"
            >
              <div className="network-heading">
                <h2 id="network-title">Vários bancos. Vários assistentes.</h2>
                <p>
                  O histórico fica no Caderninho. A escolha da IA fica com você.
                </p>
              </div>
              <div
                data-ui
                id="mcp-flow"
              >
                <McpStaticFlow />
              </div>
              <figcaption>
                Bancos ilustrativos. A cobertura depende da instituição e da
                Pluggy.
              </figcaption>
            </figure>
          </section>

          <section
            aria-labelledby="freedom-title"
            className="landing-section freedom-section"
            id="como-funciona"
          >
            <div className="section-intro">
              <h2 id="freedom-title">
                Troque de IA.
                <br />
                Mantenha seu Caderninho.
              </h2>
              <p>
                O MCP conecta sua base a vários assistentes. Seus dados e regras
                continuam no mesmo lugar.
              </p>
            </div>
            <dl className="freedom-list">
              <div>
                <dt>
                  <CheckIcon
                    aria-hidden
                    size={18}
                  />
                  O histórico continua seu
                </dt>
                <dd>
                  Bancos, categorias e regras na sua instalação, sem reimportar
                  ao trocar de IA.
                </dd>
              </div>
              <div>
                <dt>
                  <CheckIcon
                    aria-hidden
                    size={18}
                  />
                  Mais de um assistente, ao mesmo tempo
                </dt>
                <dd>
                  O mesmo endereço MCP para todos os clientes que você
                  autorizar.
                </dd>
              </div>
              <div>
                <dt>
                  <CheckIcon
                    aria-hidden
                    size={18}
                  />
                  Você controla o acesso
                </dt>
                <dd>
                  Acompanhe chamadas e revogue autorizações em Observabilidade.
                </dd>
              </div>
            </dl>
            <p className="section-note">
              Cada cliente define seus modelos e planos e precisa oferecer MCP
              remoto com OAuth.
            </p>
          </section>

          <section
            aria-labelledby="desempenho"
            className="landing-section"
          >
            <div className="section-intro">
              <h2 id="desempenho">Uma pergunta. Uma consulta agregada.</h2>
              <p>
                O Caderninho filtra e calcula na sua base. A IA recebe os totais
                prontos para responder.
              </p>
            </div>
            <LayerCard className="performance-surface">
              <div
                data-ui
                id="landing-performance"
              >
                <LandingPerformance />
              </div>
            </LayerCard>
            <details className="performance-evidence">
              <summary>Premissas e evidências do D1</summary>
              <p>
                A comparação considera uma ferramenta por página de 500
                registros, contra uma chamada agregada, com filtros conhecidos e
                base já sincronizada. A importação inicial continua necessária.
                O percentual mede chamadas; latência e tokens não foram
                comparados.
              </p>
              <dl className="performance-proof">
                <div>
                  <dt>Dois períodos comparados</dt>
                  <dd>1 passagem</dd>
                </div>
                <div>
                  <dt>Registros materializados</dt>
                  <dd>10</dd>
                </div>
                <div>
                  <dt>Linhas de transações lidas</dt>
                  <dd>Até 30</dd>
                </div>
              </dl>
              <p>
                Evidência do commit: 10 mil registros fora do período e 10
                dentro. Filtros por período e conta no SQL; leituras auxiliares
                não incluídas.{" "}
                <a
                  href={`${repository}/commit/97d2fac97cb4c23a03ad33849d7c0e14aaa433b7`}
                >
                  Ver implementação e evidências
                </a>
                .
              </p>
            </details>
          </section>

          <section
            aria-labelledby="connect-title"
            className="landing-section"
            id="conectar"
          >
            <div className="section-intro">
              <h2 id="connect-title">Como conectar suas IAs</h2>
              <p>
                Conecte os bancos uma vez. Autorize quantos clientes compatíveis
                quiser.
              </p>
            </div>
            <ol className="connection-guide">
              <li>
                <div>
                  <h3>Conecte seus bancos</h3>
                  <p>
                    Autorize os bancos no Meu Pluggy. No Caderninho, conecte o
                    Meu Pluggy e importe a visão.
                  </p>
                </div>
              </li>
              <li>
                <div>
                  <h3>Copie seu endereço MCP</h3>
                  <p>
                    Em Conexões, copie a URL para conectar seu assistente MCP.
                  </p>
                  <code className="endpoint-example">
                    https://sua-instancia.workers.dev/mcp
                  </code>
                  <p className="section-note">
                    Exemplo. Use a URL do seu painel.
                  </p>
                </div>
              </li>
              <li>
                <div>
                  <h3>Autorize cada assistente</h3>
                  <p>
                    Adicione a URL ao cliente e conclua o OAuth. Para outra IA,
                    use o mesmo endereço.
                  </p>
                  <a
                    className="inline-link"
                    href="#produto"
                  >
                    Escolher um cliente no diagrama{" "}
                    <ArrowRightIcon
                      aria-hidden
                      size={16}
                    />
                  </a>
                </div>
              </li>
              <li>
                <div>
                  <h3>Confirme a conexão</h3>
                  <p>
                    Peça o status do Caderninho. Confira a chamada em
                    Observabilidade e a data da última sincronização.
                  </p>
                </div>
              </li>
            </ol>
          </section>

          <section
            aria-labelledby="rules-title"
            className="landing-section"
            id="regras"
          >
            <div className="section-intro">
              <h2 id="rules-title">Suas regras, em qualquer assistente</h2>
              <p>
                Crie a regra uma vez. Todos os assistentes consultam a mesma
                classificação.
              </p>
            </div>
            <div
              className="rule-stage"
              data-ui
              id="landing-rule"
            >
              <LandingRuleExample />
            </div>
            <div className="rules-notes">
              <p>
                E combina condições; OU cria alternativas. A primeira regra
                ativa que corresponder vence.
              </p>
              <p>
                Salvar vale para próximas importações. Reaplicar ao histórico é
                uma ação separada.
              </p>
            </div>
            <div className="section-action">
              <UiLink
                href="/demo/rules?month=2026-10"
                variant="secondary"
              >
                Explorar regras na demo
              </UiLink>
              <span>
                Exemplo interativo com o motor real e dados fictícios.
              </span>
            </div>
          </section>

          <section
            aria-labelledby="cost-title"
            className="landing-section"
            id="free-tier"
          >
            <div className="section-intro">
              <h2 id="cost-title">Pensado para rodar a custo zero.</h2>
              <p>
                Caderninho gratuito e código aberto. Cloudflare Free e Meu
                Pluggy para uso pessoal, dentro das cotas dos fornecedores.
              </p>
            </div>
            <LayerCard className="cost-surface">
              <dl className="cost-list">
                <div>
                  <dt>Cloudflare</dt>
                  <dd className="cost-value">Free</dd>
                  <dd>Workers, D1, KV e Workflows nas cotas gratuitas.</dd>
                </div>
                <div>
                  <dt>Meu Pluggy</dt>
                  <dd className="cost-value">Gratuito</dd>
                  <dd>
                    Seus próprios dados, até cinco conexões, sem uso comercial.
                  </dd>
                </div>
                <div>
                  <dt>Sua IA</dt>
                  <dd className="cost-value">Você escolhe</dd>
                  <dd>
                    Use o cliente compatível que já tem. O plano de IA é
                    independente.
                  </dd>
                </div>
              </dl>
            </LayerCard>
            <details className="cost-details">
              <summary>Cotas e condições do custo zero</summary>
              <p>
                Simulação diária: 555 transações, 100 consultas MCP, uma
                sincronização sem novidades e seis renovações OAuth.
              </p>
              <div className="quota-table">
                <table>
                  <caption>Projeção diária de D1 e KV</caption>
                  <thead>
                    <tr>
                      <th scope="col">Recurso</th>
                      <th scope="col">Uso / cota Free</th>
                      <th scope="col">Fração</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotas.map((row) => (
                      <tr key={row.name}>
                        <th scope="row">{row.name}</th>
                        <td>
                          {count.format(row.used)}
                          <span> / {count.format(row.quota)}</span>
                        </td>
                        <td>{percent.format(row.used / row.quota)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                Projeção de 22 out 2026. As cotas são diárias e compartilhadas
                pela conta. D1 conta linhas examinadas. Novas importações e
                outras aplicações aumentam o consumo.
              </p>
              <p className="source-links">
                <a href="https://developers.cloudflare.com/d1/platform/pricing/">
                  Cotas D1
                </a>
                <a href="https://developers.cloudflare.com/kv/platform/pricing/">
                  Cotas KV
                </a>
                <a href="https://developers.cloudflare.com/workers/platform/pricing/">
                  Preços Workers
                </a>
                <a href="https://docs.pluggy.ai/en/docs/guides/meu-pluggy-personal-use">
                  Uso pessoal Pluggy
                </a>
              </p>
            </details>
            <details className="cost-details">
              <summary>Validação da operação no Free</summary>
              <p>
                A operação completa no Free e o primeiro deploy em conta nova
                ainda estão em validação. Na importação local, páginas de 500
                registros chegaram a 10,3 ms de CPU média, acima dos 10 ms por
                etapa do Workflows Free.
              </p>
              <p>
                Benchmark de 23 out 2026: 50 execuções Node 24 após cinco
                aquecimentos, sem D1 ou HTTP. CPU em produção ainda não medida.{" "}
                <a href="https://developers.cloudflare.com/workflows/reference/limits/">
                  Ver limites do Workflows
                </a>
                .
              </p>
            </details>
          </section>

          <section
            aria-labelledby="faq-title"
            className="landing-section faq-section"
          >
            <div className="section-intro">
              <h2 id="faq-title">Antes de conectar</h2>
            </div>
            <div className="faq-list">
              <details>
                <summary>
                  Sem lock-in significa que posso usar qualquer LLM?
                </summary>
                <p>
                  Clientes com MCP remoto e OAuth acessam a mesma base. Cada
                  aplicativo define seus modelos e planos; conversas não são
                  transferidas entre eles.
                </p>
                <p>
                  O padrão aberto permite trocar de assistente. A infraestrutura
                  usa Cloudflare e a conexão bancária, Pluggy.
                </p>
              </details>
              <details>
                <summary>Quem recebe meus dados?</summary>
                <p>
                  O histórico fica na sua Cloudflare. Resultados consultados
                  chegam ao cliente e ao modelo escolhido, sob as políticas
                  desse provedor. Credenciais Pluggy ficam nos seus secrets.
                </p>
              </details>
              <details>
                <summary>
                  As consultas sempre usam os dados mais recentes?
                </summary>
                <p>
                  Usam a última cópia sincronizada, com data e cobertura nos
                  resultados. Importações parciais e falhas continuam visíveis.
                </p>
              </details>
            </div>
          </section>
          <section
            aria-labelledby="install-title"
            className="install-section"
            id="instalar"
          >
            <div>
              <h2 id="install-title">
                Uma base sua.
                <br />A IA que você escolher.
              </h2>
              <p>
                Instale o Caderninho, conecte seus bancos e autorize seus
                assistentes.
              </p>
            </div>
            <div className="install-actions">
              <InstallLink />
              <a href="/demo?month=2026-10">
                Testar a demo com dados fictícios
              </a>
            </div>
          </section>
        </main>
        <footer className="landing-footer">
          <p>
            Caderninho · Projeto pessoal de{" "}
            <a href="https://github.com/DanielSuhett">DanielSuhett</a>
          </p>
          <a href={repository}>Código aberto</a>
          <a href={`${repository}#começar`}>Instruções de instalação</a>
        </footer>
      </div>
      <script
        src="/landing.js"
        type="module"
      />
    </Document>
  );
}
