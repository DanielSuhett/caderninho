import {
  BankIcon,
  ChatCircleTextIcon,
  CloudIcon,
  DatabaseIcon,
  PlugsConnectedIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react";

export const mcpBanks = [
  "Banco principal",
  "Banco da reserva",
  "Banco do cartão",
];
export const mcpClients = [
  { id: "chatgpt", name: "ChatGPT", provider: "OpenAI" },
  { id: "claude", name: "Claude", provider: "Anthropic" },
  { id: "other", name: "Outro cliente", provider: "MCP remoto + OAuth" },
] as const;
export type McpClientId = (typeof mcpClients)[number]["id"];
const clientGuideTitles: Record<McpClientId, string> = {
  chatgpt: "No ChatGPT",
  claude: "No Claude",
  other: "No cliente que você escolher",
};

export const networkNodeClass =
  "network-node rounded-md bg-kumo-base ring ring-kumo-line";

export function BankNode({ name }: { name: string }) {
  return (
    <div className="network-identity">
      <BankIcon
        aria-hidden
        size={20}
      />
      <span>{name}</span>
    </div>
  );
}

export function PluggyNode() {
  return (
    <>
      <PlugsConnectedIcon
        aria-hidden
        className="network-symbol"
        size={24}
      />
      <p className="network-name">Pluggy</p>
      <p className="network-description">Conecta e sincroniza os bancos.</p>
    </>
  );
}

export function CaderninhoNode() {
  return (
    <>
      <div className="network-identity">
        <CloudIcon
          aria-hidden
          size={24}
        />
        <p className="network-name">Caderninho</p>
      </div>
      <p className="network-description">Na sua Cloudflare</p>
      <ul className="network-capabilities">
        <li>
          <DatabaseIcon
            aria-hidden
            size={16}
          />
          Histórico e regras
        </li>
        <li>
          <ShieldCheckIcon
            aria-hidden
            size={16}
          />
          Acesso por OAuth
        </li>
      </ul>
      <span className="network-endpoint">
        Um endereço <code>/mcp</code>
      </span>
    </>
  );
}

export function ClientNode({
  client,
}: {
  client: (typeof mcpClients)[number];
}) {
  return (
    <div className="network-identity">
      <ChatCircleTextIcon
        aria-hidden
        size={20}
      />
      <span>
        <span className="network-name">{client.name}</span>
        <span className="network-description">{client.provider}</span>
      </span>
    </div>
  );
}

export function McpClientGuide({ selected }: { selected: McpClientId }) {
  return (
    <div
      aria-live="polite"
      className="network-client-guide"
      id="guia-do-cliente"
    >
      <div className="network-guide-title">
        <h3>{clientGuideTitles[selected]}</h3>
        <p>O mesmo endereço. A mesma base.</p>
      </div>
      {selected === "chatgpt" && (
        <div>
          <p>
            Em Plugins, adicione um servidor MCP personalizado com o endereço da
            sua instalação e autenticação OAuth.
          </p>
          <a href="https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt">
            Guia oficial do ChatGPT
          </a>
        </div>
      )}
      {selected === "claude" && (
        <div>
          <p>
            Em Personalizar → Conectores, adicione um conector personalizado.
            Informe o endereço MCP e conclua o OAuth no Caderninho.
          </p>
          <a href="https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp">
            Guia oficial do Claude
          </a>
        </div>
      )}
      {selected === "other" && (
        <div>
          <p>
            Escolha um cliente com suporte a MCP remoto e OAuth. Cadastre o
            mesmo endereço do Caderninho e autorize esse cliente. O aplicativo
            define quais modelos você pode usar.
          </p>
          <a href="https://modelcontextprotocol.io/docs/learn/architecture">
            Como funciona o padrão MCP
          </a>
        </div>
      )}
    </div>
  );
}

// Complete readable diagram while the optional Kumo Flow adapter loads.
export function McpStaticFlow() {
  return (
    <>
      <div className="network-static">
        <ul
          aria-label="Bancos de exemplo"
          className="network-bank-list"
        >
          {mcpBanks.map((name) => (
            <li
              className={networkNodeClass}
              key={name}
            >
              <BankNode name={name} />
            </li>
          ))}
        </ul>
        <div className={`${networkNodeClass} network-pluggy`}>
          <PluggyNode />
        </div>
        <div className={`${networkNodeClass} network-core`}>
          <CaderninhoNode />
        </div>
        <ul
          aria-label="Exemplos de clientes MCP"
          className="network-client-list"
        >
          {mcpClients.map((client) => (
            <li
              className={networkNodeClass}
              key={client.id}
            >
              <ClientNode client={client} />
            </li>
          ))}
        </ul>
      </div>
      <McpClientGuide selected="chatgpt" />
      <noscript>
        <p className="network-note">
          No Claude ou em outro cliente compatível, cadastre o mesmo endereço
          MCP e autorize por OAuth.
        </p>
      </noscript>
    </>
  );
}
