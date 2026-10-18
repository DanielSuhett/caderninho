import { Document } from "#web/document.tsx";
import { UiLink } from "#web/ui.tsx";

export function landingPage() {
  return (
    <Document
      title="Caderninho · MCP financeiro pessoal"
      head={
        <>
          <meta
            name="description"
            content="Seus dados financeiros na sua Cloudflare, disponíveis no seu cliente MCP."
          />
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
            font-size: 29px;
            font-weight: 650;
            letter-spacing: -0.055em;
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
            font-size: 15px;
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
            font-size: clamp(44px, 6.5vw, 88px);
            line-height: 1.02;
            letter-spacing: -0.055em;
            font-weight: 600;
            margin: 0 auto 28px;
            text-wrap: balance;
          }
          h2 {
            font-size: clamp(29px, 3.3vw, 42px);
            line-height: 1.13;
            letter-spacing: -0.035em;
            font-weight: 550;
          }
          h3 {
            font-size: 21px;
            font-weight: 550;
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
            font-size: 21px;
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
          details {
            border-bottom: 1px solid var(--line);
            padding: 16px 0;
          }
          summary {
            cursor: pointer;
            min-height: 48px;
            align-content: center;
            font-size: 19px;
            font-weight: 550;
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
              font-size: 19px;
            }
            .install {
              grid-template-columns: 1fr;
              gap: 32px;
            }
          }
        `}</style>
        </>
      }
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
            className="brand"
            href="/"
            aria-label="Caderninho, início"
          >
            caderninho.
          </a>
          <nav aria-label="Navegação principal">
            <a href="https://github.com/DanielSuhett/caderninho">Código</a>
            <a href="/account">Entrar nesta instância</a>
          </nav>
        </header>
        <main id="conteudo">
          <section
            className="hero"
            aria-labelledby="hero-title"
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
              <UiLink href="https://deploy.workers.cloudflare.com/?url=https://github.com/DanielSuhett/caderninho">
                Instalar na minha Cloudflare
              </UiLink>
              <a href="/account">Abrir meu painel</a>
            </div>
            <p className="note">
              Software gratuito. Cloudflare e Pluggy têm limites e custos
              próprios.
            </p>
          </section>
          <section
            className="install"
            aria-labelledby="install-title"
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
            className="faq"
            aria-labelledby="faq-title"
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
                Use um cliente com suporte a OAuth remoto. Operações duráveis
                também dependem do suporte a MCP Tasks. A compatibilidade
                precisa ser validada no cliente e na versão escolhidos.
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
