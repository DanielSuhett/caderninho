import { useCallback, useState } from "react";

import { UiButton } from "../ui";
import { BankMark, bankMarks } from "./bank-mark";
import { DesignPalette } from "./design-palette";
import { DisclosureItem } from "./disclosure-item";
import { TransactionList } from "./transaction-list";
import { EmptyView } from "./workspace-filters";
import { ResourceFeedback } from "./workspace-resource";
import {
  FilterDrawer,
  RefreshButton,
  WorkspaceHeading,
  WorkspaceMetrics,
  WorkspaceSkeleton,
} from "./workspace-ui";

const spaces = [1, 2, 3, 4, 6, 8];

export function DesignSystemView() {
  const params = new URLSearchParams(location.search);
  const [confirm, setConfirm] = useState(false);
  const ask = useCallback(() => setConfirm(true), []);
  const cancel = useCallback(() => setConfirm(false), []);
  const confirmed = useCallback(() => {
    setConfirm(false);
    setMessage("Confirmação demonstrada. Nenhum acesso foi revogado.");
  }, []);
  const [message, setMessage] = useState(
    "Exemplos fictícios. Nenhum dado financeiro é alterado.",
  );
  const primary = useCallback(
    () => setMessage("Ação primária demonstrada. Nenhuma alteração foi salva."),
    [],
  );
  const secondary = useCallback(
    () => setMessage("Ação secundária demonstrada."),
    [],
  );
  const refresh = useCallback(
    () =>
      setMessage(
        "Atualização demonstrada. Nas páginas de dados, a lista permanece visível durante a consulta.",
      ),
    [],
  );
  return (
    <div className="design-system">
      <WorkspaceHeading
        description="Componentes reais do painel. Use estas peças para compor novas páginas sem criar outra linguagem visual."
        title="Referência visual"
      />
      <p
        className="muted"
        role="status"
      >
        {message}
      </p>
      <section aria-labelledby="design-foundations">
        <h2 id="design-foundations">Base visual</h2>
        <p>
          Hanken Grotesk, servida localmente. Fundo contínuo, superfícies
          discretas e laranja reservado para ação, foco e seleção.
        </p>
        <dl className="design-type-scale">
          <div>
            <dt>Página</dt>
            <dd className="design-title-sample">28–32 px · título</dd>
          </div>
          <div>
            <dt>Seção</dt>
            <dd className="design-section-sample">20 px · seção</dd>
          </div>
          <div>
            <dt>Corpo</dt>
            <dd>15 px · texto operacional</dd>
          </div>
          <div>
            <dt>Controle</dt>
            <dd className="design-control-sample">14 px · filtro e ação</dd>
          </div>
          <div>
            <dt>Metadado</dt>
            <dd className="design-caption-sample">
              12 px · informação auxiliar
            </dd>
          </div>
        </dl>
        <div className="design-spacing">
          {spaces.map((space) => (
            <div key={space}>
              <span
                aria-hidden="true"
                style={{ width: `var(--space-${space})` }}
              />
              <code>{space * 4} px</code>
            </div>
          ))}
        </div>
        <p className="muted">
          4 e 8 px aproximam informações relacionadas. 12 e 16 px organizam
          controles. 24 e 32 px separam seções e estrutura.
        </p>
      </section>
      <DesignPalette demonstrate={secondary} />
      <section aria-labelledby="design-banks">
        <h2 id="design-banks">Identidade dos bancos</h2>
        <p>
          Marcas locais de 24 px, sempre acompanhadas do nome. Exemplos de
          catálogo; não representam bancos conectados.
        </p>
        <div className="bank-examples">
          {bankMarks.map((bank) => (
            <div key={bank.id}>
              <BankMark institution={bank.id} />
              <span>{bank.name}</span>
            </div>
          ))}
          <div>
            <BankMark />
            <span>Instituição não identificada</span>
          </div>
        </div>
        <p className="muted">
          O painel atual não recebe um identificador de instituição por conta.
          Por isso, as contas usam o símbolo neutro; não inferimos a marca pelo
          nome da conta ou do perfil.
        </p>
      </section>
      <section aria-labelledby="design-actions">
        <h2 id="design-actions">Ações e foco</h2>
        <p>
          Uma ação primária por tarefa. Ícones só para ações reconhecíveis, com
          nome acessível e dica. Use Tab para conferir o foco.
        </p>
        <div className="design-actions">
          <UiButton
            onClick={primary}
            type="button"
          >
            Ação primária
          </UiButton>
          <UiButton
            onClick={secondary}
            type="button"
            variant="secondary"
          >
            Ação secundária
          </UiButton>
          <RefreshButton
            label="Demonstrar atualização"
            onClick={refresh}
          />
          <UiButton
            disabled
            type="button"
            variant="secondary"
          >
            Indisponível
          </UiButton>
        </div>
        <p className="muted">
          Alvo mínimo de 44 × 44 px. Revogação e outras consequências
          importantes mantêm texto e confirmação explícitos.
        </p>
      </section>
      <section aria-labelledby="design-layout">
        <h2 id="design-layout">Receita de leitura</h2>
        <p>
          Cabeçalho → filtros → feedback → resumo → registros. Filtrar esta
          demonstração apenas recarrega a galeria.
        </p>
        <FilterDrawer
          action="/account/design-system"
          summary={[
            params.get("demoSpace") === "family"
              ? "Grupo: Casa · exemplo"
              : "Grupo: Pessoal · exemplo",
            params.get("demoPerson")
              ? "Pessoa de exemplo"
              : "Todas as pessoas · exemplo",
            ...(params.get("demoSearch")
              ? [`Busca: ${params.get("demoSearch")}`]
              : []),
          ]}
        >
          <label>
            Grupo
            <select
              defaultValue={params.get("demoSpace") ?? "personal"}
              name="demoSpace"
            >
              <option value="personal">Pessoal · exemplo</option>
              <option value="family">Casa · exemplo</option>
            </select>
          </label>
          <label>
            Pessoa
            <select
              defaultValue={params.get("demoPerson") ?? ""}
              name="demoPerson"
            >
              <option value="">Todas · exemplo</option>
              <option value="demo">Pessoa de exemplo</option>
            </select>
          </label>
          <label>
            Descrição
            <input
              defaultValue={params.get("demoSearch") ?? ""}
              name="demoSearch"
              placeholder="Buscar no exemplo"
            />
          </label>
        </FilterDrawer>
        <WorkspaceMetrics
          items={[
            {
              hint: "Separadas por titular",
              label: "Contas · exemplo",
              value: "6",
            },
            {
              hint: "Resumo sem card extra",
              label: "Transações · exemplo",
              value: "80",
            },
            {
              hint: "Dado fictício",
              label: "Última atualização",
              value: "Hoje",
            },
          ]}
        />
        <TransactionList
          accounts={[
            { id: "demo-card", name: "Cartão da casa" },
            { id: "demo-checking", name: "Conta corrente" },
          ]}
          categories={[]}
          records={[
            {
              accountId: "demo-card",
              amountMinor: "-12345",
              category: "Alimentação",
              currency: "BRL",
              date: "2026-10-22",
              description: "Mercado · exemplo",
              direction: "DEBIT",
              id: "demo-expense",
              ignored: false,
              manual: false,
              personId: "demo-ana",
              personName: "Ana (exemplo)",
              status: "POSTED",
            },
            {
              accountId: "demo-checking",
              amountMinor: "850000",
              category: "Salário",
              currency: "BRL",
              date: "2026-10-22",
              description: "Salário · exemplo",
              direction: "CREDIT",
              id: "demo-income",
              ignored: false,
              manual: false,
              personId: "demo-bruno",
              personName: "Bruno (exemplo)",
              status: "POSTED",
            },
            {
              accountId: "demo-card",
              amountMinor: "-26780",
              category: "Casa",
              currency: "BRL",
              date: "2026-10-21",
              description: "Materiais para manutenção do apartamento · exemplo",
              direction: "DEBIT",
              id: "demo-pending",
              ignored: true,
              manual: true,
              personId: "demo-ana",
              personName: "Ana (exemplo)",
              status: "PENDING",
            },
            {
              accountId: "demo-checking",
              amountMinor: "9007199254740993",
              category: null,
              currency: "USD",
              date: "2026-10-20",
              description: "Valor elevado · teste de precisão e layout",
              direction: "CREDIT",
              id: "demo-large",
              ignored: true,
              manual: true,
              personId: "demo-bruno",
              personName: "Bruno (exemplo)",
              status: "POSTED",
            },
            {
              accountId: "demo-checking",
              amountMinor: null,
              category: null,
              currency: "BRL",
              date: "2026-10-20",
              description: "Valor não informado · exemplo",
              direction: "DEBIT",
              id: "demo-missing",
              ignored: false,
              manual: false,
              personId: "demo-bruno",
              personName: "Bruno (exemplo)",
              status: "POSTED",
            },
          ]}
        />
      </section>
      <section aria-labelledby="design-disclosures">
        <h2 id="design-disclosures">Listas que abrem pelo item inteiro</h2>
        <p>
          Contas, regras, grupos e sincronizações compartilham o mesmo
          disclosure de Transações. Estados importantes ficam visíveis; ações e
          identificadores ficam nos detalhes. Use clique, Enter ou Espaço.
        </p>
        <ul
          aria-label="Exemplo de disclosure"
          className="record-list"
        >
          <li>
            <DisclosureItem
              className="record-item"
              summary={
                <>
                  <span className="record-title">
                    Compras da casa · exemplo
                  </span>
                  <span className="record-value">
                    <span
                      className="status-label"
                      data-tone="neutral"
                    >
                      Ativa
                    </span>
                  </span>
                  <span className="record-context">
                    Contém “Mercado” · Alimentação
                  </span>
                  <span className="record-meta">
                    <span>Prioridade 10</span>
                    <span>Saídas</span>
                    <span>Todas as contas do grupo</span>
                  </span>
                </>
              }
            >
              <div className="record-detail">
                <dl className="detail-list">
                  <div>
                    <dt>Categoria</dt>
                    <dd>Alimentação</dd>
                  </div>
                  <div>
                    <dt>Identificador fictício</dt>
                    <dd>
                      <code>demo-rule</code>
                    </dd>
                  </div>
                </dl>
                <a href="/account/rules">Ver regras da instalação</a>
              </div>
            </DisclosureItem>
          </li>
        </ul>
      </section>
      <section aria-labelledby="design-states">
        <h2 id="design-states">Estados de consulta</h2>
        <p>
          Skeleton na primeira carga. Ao atualizar, preserve os dados exibidos;
          falhas devem informar que eles podem estar desatualizados.
        </p>
        <details>
          <summary>Ver skeleton de carregamento</summary>
          <WorkspaceSkeleton />
        </details>
        <details>
          <summary>Ver estado vazio</summary>
          <EmptyView title="Nenhum registro neste filtro">
            Ajuste os filtros para ampliar a consulta. Ausência de registros não
            significa saldo zero.
          </EmptyView>
        </details>
        <details>
          <summary>Ver atualização e dados anteriores</summary>
          <ResourceFeedback
            data={{ example: true }}
            error={false}
            loading
            retry={refresh}
          />
          <p className="muted">
            Exemplo: a lista anterior continua visível durante a atualização.
          </p>
        </details>
        <details>
          <summary>Ver erro com recuperação</summary>
          <ResourceFeedback
            data={{ example: true }}
            error
            loading={false}
            retry={refresh}
          />
        </details>
        <details>
          <summary>Ver confirmação de revogação</summary>
          {confirm ? (
            <div className="design-actions">
              <p>Revogar o acesso do assistente de exemplo?</p>
              <UiButton
                onClick={confirmed}
                tone="danger"
                type="button"
              >
                Confirmar demonstração
              </UiButton>
              <UiButton
                onClick={cancel}
                type="button"
                variant="secondary"
              >
                Cancelar
              </UiButton>
            </div>
          ) : (
            <UiButton
              onClick={ask}
              type="button"
              variant="secondary"
            >
              Demonstrar revogação
            </UiButton>
          )}
        </details>
        <p className="muted">
          A animação respeita a preferência por movimento reduzido. Erros usam
          mensagem e recuperação; não dependem somente de cor.
        </p>
      </section>
      <section aria-labelledby="design-compose">
        <h2 id="design-compose">Composição para desenvolvimento</h2>
        <p>
          Importe <code>WorkspaceHeading</code>, <code>FilterDrawer</code>,{" "}
          <code>WorkspaceMetrics</code>, <code>RefreshButton</code> e{" "}
          <code>WorkspaceSkeleton</code> de{" "}
          <code>src/web/account/workspace-ui.tsx</code>.
        </p>
        <p>
          Contratos, estados, receitas TSX e critérios de revisão estão em{" "}
          <code>docs/design-system.md</code>. A identidade está em{" "}
          <code>DESIGN.md</code>. Altere a peça compartilhada para corrigir o
          padrão em todas as páginas.
        </p>
      </section>
    </div>
  );
}
