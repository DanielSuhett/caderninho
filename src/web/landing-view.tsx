import { PublicLayout } from "./public-layout";
import { UiLink } from "./ui";

export function landingPage() {
  return (
    <PublicLayout
      description="Importe seus bancos pela Pluggy e consulte seus dados pelo MCP. Uma instalação pessoal na sua Cloudflare, com titular, origem e acesso identificados."
      title="Caderninho · suas finanças no seu assistente"
    >
      <main
        id="conteudo"
        tabIndex={-1}
      >
        <section
          aria-labelledby="hero-title"
          className="landing-hero"
        >
          <div className="public-reveal">
            <p className="public-kicker">MCP financeiro pessoal</p>
            <h1 id="hero-title">
              Suas finanças.
              <br />
              No seu assistente.
            </h1>
            <p className="landing-intro">
              Importe seus bancos pela Pluggy e consulte seu histórico no
              assistente de IA que você escolher. O Caderninho organiza os dados
              na sua Cloudflare e os disponibiliza pelo MCP.
            </p>
            <div className="public-actions">
              <UiLink href="https://deploy.workers.cloudflare.com/?url=https://github.com/DanielSuhett/caderninho">
                Instalar na minha Cloudflare
              </UiLink>
              <a href="/account">Entrar nesta instalação</a>
            </div>
            <p className="public-note">
              Software gratuito. Cloudflare e Pluggy têm limites e custos
              próprios.
            </p>
          </div>
          <figure className="public-example public-surface public-reveal public-reveal-delayed">
            <figcaption>
              <span>Exemplo fictício</span>
              <span>Consulta não executada</span>
            </figcaption>
            <h2>Despesas por categoria</h2>
            <p className="example-period">1 a 22 de outubro de 2026 · BRL</p>
            <dl className="example-values">
              <div>
                <dt>Alimentação</dt>
                <dd>R$ 842,30</dd>
              </div>
              <div>
                <dt>Transporte</dt>
                <dd>R$ 218,50</dd>
              </div>
              <div>
                <dt>Casa</dt>
                <dd>R$ 1.400,00</dd>
              </div>
            </dl>
            <footer>
              No seu assistente, consulte por período, categoria ou pessoa.
              Confira a origem e a atualização dos dados.
            </footer>
          </figure>
        </section>
        <section
          aria-labelledby="how-title"
          className="landing-how"
          id="como-funciona"
        >
          <h2 id="how-title">Do seu banco à sua próxima pergunta.</h2>
          <p>
            O painel conecta e organiza. A conversa acontece no seu assistente.
          </p>
          <ol className="public-steps">
            <li>
              <h3>Instale na sua Cloudflare</h3>
              <p>
                Defina sua senha e as credenciais da aplicação Pluggy. A
                instalação fica sob seu controle.
              </p>
            </li>
            <li>
              <h3>Conecte e importe</h3>
              <p>
                Autorize seus bancos pelo Meu Pluggy. Organize perfis e
                titulares para saber de quem é cada conta.
              </p>
            </li>
            <li>
              <h3>Autorize seu assistente</h3>
              <p>
                Adicione a URL MCP ao seu cliente de IA e autorize o acesso. No
                painel, acompanhe uso e revogue autorizações.
              </p>
            </li>
          </ol>
        </section>
        <section
          aria-labelledby="faq-title"
          className="landing-faq"
        >
          <h2 id="faq-title">Antes de começar.</h2>
          <div>
            <details>
              <summary>Onde ficam os dados e quem pode acessá-los?</summary>
              <p>
                Os dados ficam na sua conta Cloudflare. Você controla a
                instalação e as autorizações. Os resultados consultados pelo MCP
                são enviados ao cliente de IA escolhido e podem ser processados
                pelo seu provedor de modelo.
              </p>
              <p>
                As credenciais principais ficam nos secrets do Worker; perfis
                Pluggy adicionais usam o armazenamento privado da instalação. O
                titular declarado organiza as contas, mas não cria permissões
                separadas entre pessoas.
              </p>
            </details>
            <details>
              <summary>Os dados estão sempre atualizados?</summary>
              <p>
                As consultas usam a cópia sincronizada. A cobertura depende do
                que sua instituição fornece à Pluggy. Confira a data de
                atualização e eventuais dados parciais antes de analisar os
                valores.
              </p>
            </details>
            <details>
              <summary>O que preciso para instalar?</summary>
              <p>
                Uma conta Cloudflare, credenciais de uma aplicação Pluggy e um
                cliente com suporte a MCP remoto com OAuth. A compatibilidade
                depende do cliente e da versão utilizados.
              </p>
              <p>
                O primeiro deploy pelo botão em uma conta nova ainda exige
                validação real.{" "}
                <a href="https://github.com/DanielSuhett/caderninho#começar">
                  Consulte as instruções de instalação
                </a>
                . O botão usa a versão publicada no GitHub.
              </p>
            </details>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}
