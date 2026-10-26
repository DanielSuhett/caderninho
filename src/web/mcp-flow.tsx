import { Flow } from "@cloudflare/kumo/components/flow";
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";

import {
  BankNode,
  CaderninhoNode,
  ClientNode,
  McpClientGuide,
  type McpClientId,
  mcpBanks,
  mcpClients,
  networkNodeClass,
  PluggyNode,
} from "./mcp-steps";

export function McpFlow() {
  const root = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  const [selected, setSelected] = useState<McpClientId>("chatgpt");
  useEffect(() => {
    const element = root.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setWide((entry?.contentRect.width ?? 0) >= 950);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const selectClient = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const client = mcpClients.find(
      (item) => item.id === event.currentTarget.dataset.client,
    );
    if (client) {
      setSelected(client.id);
    }
  }, []);
  return (
    <div
      className="mcp-network"
      data-wide={wide}
      ref={root}
    >
      <p className="network-instruction">
        Escolha um assistente para ver como conectar.
      </p>
      <Flow
        align="center"
        canvas={false}
        className="network-diagram"
        orientation={wide ? "horizontal" : "vertical"}
        padding={{ x: 4, y: 8 }}
      >
        {wide ? (
          <Flow.Parallel>
            {mcpBanks.map((name, index) => (
              <Flow.Node
                id={`bank-${index}`}
                key={name}
                render={<li className={networkNodeClass} />}
              >
                <BankNode name={name} />
              </Flow.Node>
            ))}
          </Flow.Parallel>
        ) : (
          <Flow.Node
            id="banks"
            render={<div className={`${networkNodeClass} network-banks`} />}
          >
            <p className="network-name">Seus bancos</p>
            <ul className="network-mobile-banks">
              {mcpBanks.map((name) => (
                <li key={name}>
                  <BankNode name={name} />
                </li>
              ))}
            </ul>
            <p className="network-description network-mobile-source">
              Conectados pela Pluggy
            </p>
          </Flow.Node>
        )}
        {!!wide && (
          <Flow.Node
            id="pluggy"
            render={<div className={`${networkNodeClass} network-pluggy`} />}
          >
            <PluggyNode />
          </Flow.Node>
        )}
        <Flow.Node
          id="caderninho"
          render={<div className={`${networkNodeClass} network-core`} />}
        >
          <CaderninhoNode />
        </Flow.Node>
        {wide ? (
          <Flow.Parallel>
            {mcpClients.map((client) => (
              <Flow.Node
                id={`client-${client.id}`}
                key={client.id}
                render={
                  <button
                    aria-controls="guia-do-cliente"
                    aria-pressed={selected === client.id}
                    className={`${networkNodeClass} network-client`}
                    data-client={client.id}
                    onClick={selectClient}
                    type="button"
                  />
                }
              >
                <ClientNode client={client} />
              </Flow.Node>
            ))}
          </Flow.Parallel>
        ) : (
          <Flow.Node
            id="clients"
            render={<div className={`${networkNodeClass} network-clients`} />}
          >
            <p className="network-name">Seus assistentes</p>
            <div className="network-mobile-clients">
              {mcpClients.map((client) => (
                <button
                  aria-controls="guia-do-cliente"
                  aria-pressed={selected === client.id}
                  className="network-client"
                  data-client={client.id}
                  key={client.id}
                  onClick={selectClient}
                  type="button"
                >
                  <ClientNode client={client} />
                </button>
              ))}
            </div>
          </Flow.Node>
        )}
      </Flow>
      <McpClientGuide selected={selected} />
    </div>
  );
}

export function mountMcpFlow(element: HTMLElement) {
  createRoot(element).render(<McpFlow />);
}
