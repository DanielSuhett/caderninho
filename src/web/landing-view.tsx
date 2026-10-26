import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import {
  ArrowRightIcon,
  CheckIcon,
  GithubLogoIcon,
} from "@phosphor-icons/react";

import { Document } from "./document";
import { LandingFaq } from "./landing-faq";
import { LandingHeroPreview } from "./landing-hero-preview";
import {
  LandingMetadata,
  landingDescription,
  landingTitle,
} from "./landing-metadata";
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

function InstallLink({
  variant = "primary",
  label = "Instalar na minha Cloudflare",
}: {
  variant?: "primary" | "secondary";
  label?: string;
} = {}) {
  return (
    <UiLink
      href={installUrl}
      size="lg"
      variant={variant}
    >
      {label}
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
            content={landingDescription}
            name="description"
          />
          {!!publicSite && <LandingMetadata />}
          {!publicSite && (
            <meta
              content="noindex,follow"
              name="robots"
            />
          )}
          <link
            href="/landing.css"
            rel="stylesheet"
          />
          <link
            as="font"
            crossOrigin="anonymous"
            href="/fonts/SourceSerif4Variable-Roman.woff2"
            rel="preload"
            type="font/woff2"
          />
        </>
      }
      title={landingTitle}
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
            <a href="#conectar">Conectar IA</a>
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
            <div className="hero-grid">
              <div className="hero-intro">
                <p className="hero-kicker">
                  <a
                    aria-label="Código aberto no GitHub, licença MIT"
                    className="hero-source"
                    href={repository}
                  >
                    <GithubLogoIcon
                      aria-hidden
                      size={22}
                    />
                    Código aberto.
                  </a>{" "}
                  <span>De graça.</span>
                </p>
                <h1 id="hero-title">
                  Suas finanças,
                  <br />
                  na sua IA.
                </h1>
                <p className="hero-description">
                  Contas, cartões e investimentos em uma base que é sua. No
                  painel, no ChatGPT ou no Claude.
                </p>
                <div className="hero-actions">
                  <UiLink
                    href="/demo?month=2026-10"
                    size="lg"
                    variant="primary"
                  >
                    Explorar a demo
                  </UiLink>
                  <InstallLink
                    label="Instalar"
                    variant="secondary"
                  />
                </div>
                <p className="hero-note">
                  Demo sem cadastro. Instalação na sua Cloudflare.{" "}
                  <a href="#free-tier">
                    Serviços externos têm planos e limites.
                  </a>
                </p>
              </div>
              <LandingHeroPreview />
            </div>
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
            aria-labelledby="investor-title"
            className="landing-section investor-landing"
            id="investimentos"
          >
            <div className="section-intro">
              <h2 id="investor-title">
                Sua carteira.
                <br />
                Em uma só visão.
              </h2>
              <p>
                Renda fixa, fundos, ações e ETFs, por pessoa e instituição.
                Posição bruta e líquida, resultado informado e valor disponível
                para resgate.
              </p>
              <UiLink
                href="/demo/investments/"
                variant="primary"
              >
                Explorar investimentos{" "}
                <ArrowRightIcon
                  aria-hidden
                  size={18}
                />
              </UiLink>
            </div>
            <LayerCard className="investor-landing-preview">
              <span className="eyebrow">Carteira de exemplo · BRL</span>
              <div className="investor-landing-total">
                R$ 60.600,00<small>Posição bruta</small>
              </div>
              <div
                aria-label="Renda fixa 47%, fundos 30%, ETFs 15%, ações 8%"
                className="investor-landing-bar"
                role="img"
              >
                <span />
                <span />
                <span />
                <span />
              </div>
              <ul>
                <li>
                  <span>Renda fixa</span>
                  <strong>47%</strong>
                </li>
                <li>
                  <span>Fundos</span>
                  <strong>30%</strong>
                </li>
                <li>
                  <span>ETFs</span>
                  <strong>15%</strong>
                </li>
                <li>
                  <span>Ações</span>
                  <strong>8%</strong>
                </li>
              </ul>
              <p>
                Também no seu assistente via MCP: “Como minha carteira está
                distribuída por instituição?”
              </p>
            </LayerCard>
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
                  Acompanhe chamadas e revogue autorizações na Auditoria MCP.
                </dd>
              </div>
            </dl>
            <p className="section-note">
              Cada cliente define seus modelos e planos e precisa oferecer MCP
              remoto com OAuth.
            </p>
          </section>

          <section
            aria-labelledby="cost-title"
            className="landing-section"
            id="free-tier"
          >
            <div className="section-intro">
              <h2 id="cost-title">
                O Caderninho é grátis. E os outros custos?
              </h2>
              <p>
                Sem assinatura do Caderninho. O código é aberto, sob licença
                MIT: você pode usar, estudar e modificar. Hospedagem, conexão
                bancária e IA são serviços independentes.
              </p>
            </div>
            <LayerCard className="cost-surface">
              <dl className="cost-list">
                <div>
                  <dt>Caderninho</dt>
                  <dd className="cost-value">Grátis</dd>
                  <dd>
                    Software de código aberto.{" "}
                    <a href={repository}>Veja o código e a licença MIT.</a>
                  </dd>
                </div>
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
            <p className="cost-condition">
              Os planos gratuitos têm cotas. A operação completa no Cloudflare
              Free ainda está em validação; não há garantia de custo zero para
              toda instalação.
            </p>
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
                    Em Pessoas, copie a URL para conectar seu assistente MCP.
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
                    Peça o status do Caderninho. Confira a chamada em Auditoria
                    MCP e a data da última importação.
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
            aria-labelledby="faq-title"
            className="landing-section faq-section"
          >
            <div className="section-intro">
              <h2 id="faq-title">Antes de conectar</h2>
            </div>
            <div id="landing-faq">
              <LandingFaq />
            </div>
          </section>
          <section
            aria-labelledby="install-title"
            className="install-section"
            id="instalar"
          >
            <div>
              <h2 id="install-title">Instale o seu Caderninho.</h2>
              <p>
                O software é grátis e de código aberto. Você cuida da sua
                instalação na Cloudflare e escolhe quais assistentes autorizar.
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
