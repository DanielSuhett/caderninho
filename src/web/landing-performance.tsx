import { Flow } from "@cloudflare/kumo/components/flow";
import { Meter } from "@cloudflare/kumo/components/meter";
import { type ChangeEvent, useCallback, useState } from "react";

const count = new Intl.NumberFormat("pt-BR");
const percent = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
  style: "percent",
});
const pageSize = 500;
const histories = [
  { label: "1 mil transações", transactions: 1000, value: "1000" },
  { label: "10 mil transações", transactions: 10_000, value: "10000" },
  { label: "100 mil transações", transactions: 100_000, value: "100000" },
];

function QueryPath({
  aggregate,
  pages,
  transactions,
  interactive,
  wide,
}: {
  aggregate: boolean;
  pages: number;
  transactions: number;
  interactive: boolean;
  wide: boolean;
}) {
  const steps = aggregate
    ? [
        { detail: "Filtra e agrega no D1", title: "Caderninho" },
        { detail: "Totais, grupos e comparação", title: "Resposta pronta" },
      ]
    : [
        {
          detail: `${count.format(pages)} páginas de até 500`,
          title: "Pluggy",
        },
        {
          detail: `${count.format(transactions)} transações recebidas`,
          title: "Cálculo no assistente",
        },
      ];
  if (!interactive) {
    return (
      <ol className="performance-static">
        {steps.map((step) => (
          <li
            className="performance-node"
            key={step.title}
          >
            <span>{step.title}</span>
            <small>{step.detail}</small>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <Flow
      align="center"
      canvas={false}
      className="performance-flow"
      orientation={wide ? "horizontal" : "vertical"}
      padding={{ x: 4, y: 8 }}
    >
      {steps.map((step, index) => (
        <Flow.Node
          id={`performance-${aggregate ? "aggregate" : "direct"}-${index}`}
          key={step.title}
          render={
            <div className="performance-node rounded-md bg-kumo-base ring ring-kumo-line" />
          }
        >
          <span>{step.title}</span>
          <small>{step.detail}</small>
        </Flow.Node>
      ))}
    </Flow>
  );
}

function PerformanceFork({
  pages,
  transactions,
}: {
  pages: number;
  transactions: number;
}) {
  return (
    <Flow
      align="center"
      canvas={false}
      className="performance-fork"
      orientation="horizontal"
      padding={{ x: 4, y: 8 }}
    >
      <Flow.Node
        id="performance-question"
        render={
          <div className="performance-node performance-endpoint rounded-md bg-kumo-base ring ring-kumo-line" />
        }
      >
        <span>Sua IA</span>
        <small>A mesma pergunta</small>
      </Flow.Node>
      <Flow.Parallel>
        <Flow.Node
          id="performance-pages"
          render={
            <div className="performance-branch rounded-md bg-kumo-base ring ring-kumo-line" />
          }
        >
          <h3>Paginar tudo na Pluggy</h3>
          <p>{count.format(transactions)} transações para a IA calcular.</p>
          <Meter
            aria-label="Chamadas ao paginar tudo na Pluggy"
            customValue={`${count.format(pages)} chamadas`}
            label="Uma tool call por página"
            max={pages}
            value={pages}
          />
        </Flow.Node>
        <Flow.Node
          id="performance-summary"
          render={
            <div className="performance-branch performance-aggregate rounded-md bg-kumo-base ring ring-kumo-line" />
          }
        >
          <h3>Consultar pelo Caderninho</h3>
          <p>Filtro e agregação no D1. Totais prontos para a IA.</p>
          <Meter
            aria-label="Chamadas ao consultar pelo Caderninho"
            customValue="1 chamada"
            label="Uma tool call agregada"
            max={pages}
            value={1}
          />
        </Flow.Node>
      </Flow.Parallel>
      <Flow.Node
        id="performance-answer"
        render={
          <div className="performance-node performance-endpoint rounded-md bg-kumo-base ring ring-kumo-line" />
        }
      >
        <span>Sua resposta</span>
        <small>Totais por período e grupo</small>
      </Flow.Node>
    </Flow>
  );
}

export function LandingPerformance({
  interactive = false,
  wide = false,
}: {
  interactive?: boolean;
  wide?: boolean;
}) {
  const [transactions, setTransactions] = useState(100_000);
  const changeHistory = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const history = histories.find(
      (item) => item.value === event.currentTarget.value,
    );
    if (history) {
      setTransactions(history.transactions);
    }
  }, []);
  const pages = Math.ceil(transactions / pageSize);
  return (
    <div
      className="performance-comparison"
      data-wide={wide}
    >
      <div className="performance-toolbar">
        <p>“Como meus gastos mudaram entre dois períodos?”</p>
        {interactive ? (
          <label className="performance-history">
            Histórico do exemplo
            <select
              onChange={changeHistory}
              value={transactions}
            >
              {histories.map((history) => (
                <option
                  key={history.value}
                  value={history.value}
                >
                  {history.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="performance-scenario">Exemplo: 100 mil transações</p>
        )}
      </div>
      {interactive && wide ? (
        <PerformanceFork
          pages={pages}
          transactions={transactions}
        />
      ) : (
        <>
          <div className="performance-lane">
            <h3>Paginar todo o histórico na Pluggy</h3>
            <QueryPath
              aggregate={false}
              interactive={interactive}
              pages={pages}
              transactions={transactions}
              wide={wide}
            />
            <Meter
              aria-label="Chamadas ao paginar tudo na Pluggy"
              customValue={`${count.format(pages)} chamadas`}
              label="Uma tool call por página"
              max={pages}
              value={pages}
            />
          </div>
          <div className="performance-lane performance-aggregate">
            <h3>Consultar pelo Caderninho</h3>
            <QueryPath
              aggregate
              interactive={interactive}
              pages={pages}
              transactions={transactions}
              wide={wide}
            />
            <Meter
              aria-label="Chamadas ao consultar pelo Caderninho"
              customValue="1 chamada"
              label="Uma tool call agregada"
              max={pages}
              value={1}
            />
          </div>
        </>
      )}
      <div className="performance-result">
        <p aria-live="polite">
          <strong>{percent.format(1 - 1 / pages)}</strong>
          <span>menos tool calls neste exemplo</span>
        </p>
        <p>
          <code>get_spending_comparison</code>
          <span>Dois períodos. Uma passagem. Totais exatos por moeda.</span>
        </p>
      </div>
      <p className="performance-assumptions">
        Simulação · 500 registros por página · consultas após sincronização.
      </p>
    </div>
  );
}
