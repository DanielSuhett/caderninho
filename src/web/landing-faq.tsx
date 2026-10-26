import { Collapsible } from "@cloudflare/kumo/components/collapsible";
import { CaretDownIcon } from "@phosphor-icons/react";

const questions = [
  {
    answer: (
      <>
        <p>
          O software Caderninho é grátis, sem assinatura, e o código está no
          GitHub sob licença MIT. Você pode ler, modificar e hospedar sua
          própria cópia. Cloudflare, Meu Pluggy e o cliente de IA têm planos e
          limites próprios.{" "}
          <a href="#free-tier">Veja as condições de cada serviço.</a>
        </p>
      </>
    ),
    id: "faq-0",
    title: "É grátis mesmo? O que significa código aberto?",
  },
  {
    answer: (
      <>
        <p>
          Um organizador de finanças pessoais de código aberto que você instala
          na sua Cloudflare. Reúne contas, cartões, transações e investimentos
          para consultar no painel ou em assistentes de IA. O MCP (Model Context
          Protocol) conecta esses assistentes à sua base, com acesso autorizado
          por você.
        </p>
      </>
    ),
    id: "faq-1",
    title: "O que é o Caderninho?",
  },
  {
    answer: (
      <>
        <p>
          Uma conta Cloudflare para instalar o Caderninho e uma conta Meu Pluggy
          para conectar os bancos. Para consultar por IA, escolha um cliente com
          MCP remoto e OAuth, como ChatGPT ou Claude. A disponibilidade depende
          do plano do cliente, da instituição financeira e da cobertura da
          Pluggy.
        </p>
      </>
    ),
    id: "faq-2",
    title: "O que preciso para começar?",
  },
  {
    answer: (
      <>
        <p>
          Clientes com MCP remoto e OAuth acessam a mesma base. Cada aplicativo
          define seus modelos e planos; conversas não são transferidas entre
          eles.
        </p>
        <p>
          O padrão aberto permite trocar de assistente. A infraestrutura usa
          Cloudflare e a conexão bancária, Pluggy.
        </p>
      </>
    ),
    id: "faq-3",
    title: "Sem lock-in significa que posso usar qualquer LLM?",
  },
  {
    answer: (
      <>
        <p>
          O histórico fica na sua Cloudflare. Resultados consultados chegam ao
          cliente e ao modelo escolhido, sob as políticas desse provedor. As
          credenciais Pluggy ficam protegidas na sua instalação.
        </p>
      </>
    ),
    id: "faq-4",
    title: "Quem recebe meus dados?",
  },
  {
    answer: (
      <>
        <p>
          Usam a última cópia sincronizada, com data e cobertura nos resultados.
          Importações parciais e falhas continuam visíveis.
        </p>
      </>
    ),
    id: "faq-5",
    title: "As consultas sempre usam os dados mais recentes?",
  },
];
export function LandingFaq({
  interactive = false,
  opened = [],
}: {
  interactive?: boolean;
  opened?: string[];
}) {
  return (
    <div className="faq-list">
      {questions.map((question) =>
        interactive ? (
          <Collapsible.Root
            className="faq-item"
            defaultOpen={opened.includes(question.id)}
            key={question.id}
          >
            <h3>
              <Collapsible.DefaultTrigger className="faq-question text-base">
                {question.title}
              </Collapsible.DefaultTrigger>
            </h3>
            <Collapsible.Panel className="faq-answer">
              <div>{question.answer}</div>
            </Collapsible.Panel>
          </Collapsible.Root>
        ) : (
          <details
            className="faq-item"
            data-question={question.id}
            key={question.id}
          >
            <summary>
              {question.title}
              <CaretDownIcon
                aria-hidden
                size={18}
              />
            </summary>
            <div className="faq-answer">{question.answer}</div>
          </details>
        ),
      )}
    </div>
  );
}
