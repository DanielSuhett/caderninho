import {
  ChatCircleTextIcon,
  DatabaseIcon,
  ShieldCheckIcon,
  SparkleIcon,
} from "@phosphor-icons/react";

export const mcpSteps = [
  {
    caption:
      "Você pergunta. O assistente escolhe uma ferramenta MCP para consultar o período.",
    description: "Transforma a pergunta em uma chamada MCP.",
    icon: ChatCircleTextIcon,
    id: "assistant",
    title: "Seu assistente",
  },
  {
    caption:
      "O Worker verifica o acesso que você autorizou e executa a ferramenta.",
    description: "Verifica o acesso antes de executar a ferramenta.",
    icon: ShieldCheckIcon,
    id: "worker",
    title: "Caderninho",
  },
  {
    caption:
      "A consulta usa o histórico importado. Os totais são calculados por moeda, sem conversão implícita.",
    description: "Consulta a cópia sincronizada com valores exatos.",
    icon: DatabaseIcon,
    id: "database",
    title: "Histórico no D1",
  },
  {
    caption:
      "Os dados voltam ao cliente de IA, que prepara a resposta. Período e cobertura parcial continuam informados.",
    description: "Devolve dados com período, moeda e cobertura.",
    icon: SparkleIcon,
    id: "result",
    title: "Dados ao cliente",
  },
] as const;

export const mcpNodeClass =
  "mcp-flow-node rounded-md bg-kumo-base shadow ring ring-kumo-line";
export const mcpSummary =
  "O MCP conecta seu assistente à cópia financeira na sua Cloudflare. Nenhuma consulta real é executada nesta ilustração.";

export function McpStepContent({ step }: { step: (typeof mcpSteps)[number] }) {
  return (
    <>
      <h3>
        <step.icon
          aria-hidden
          size={20}
        />
        {step.title}
      </h3>
      <p>{step.description}</p>
    </>
  );
}

// Readable before JavaScript, while the optional Flow chunk loads, or if it fails.
export function McpStaticFlow() {
  return (
    <>
      <div className="mcp-playback">
        <span className="mcp-step-count">Fluxo completo</span>
      </div>
      <ol
        aria-label="Etapas de uma consulta MCP"
        className="mcp-static-steps"
      >
        {mcpSteps.map((step) => (
          <li
            className={mcpNodeClass}
            key={step.id}
          >
            <McpStepContent step={step} />
          </li>
        ))}
      </ol>
      <p className="mcp-caption">{mcpSummary}</p>
    </>
  );
}
