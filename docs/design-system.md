# Caderninho: referência de interface para desenvolvimento

**Comece por uma página existente, monte com os componentes abaixo e só crie uma
peça nova quando houver uma responsabilidade que ainda não existe.** Este documento
é o contrato de composição do painel. A galeria viva fica em `/account/design-system`,
na mesma instalação autenticada, e usa os componentes reais com dados fictícios. [DESIGN.md](../DESIGN.md) define a identidade;
este guia mostra como aplicá-la desde o primeiro componente até uma página completa.

O Caderninho entrega valor pelo MCP. A interface serve para autorizar, conferir,
organizar e diagnosticar. Não é uma landing dentro de cada rota, nem outro cliente
de chat. A pergunta de design é: **qual informação ou ação permite sair desta tela
com confiança?**

## 1. Fonte da verdade

| Responsabilidade | Arquivo existente | Regra de manutenção |
| --- | --- | --- |
| Fonte local, paleta e foco global | `src/web/design.tsx` | Usar `DesignHead` pelo documento compartilhado; não importar outra fonte ou tema. |
| Botão e campo Kumo | `src/web/ui.tsx` | `UiButton` e `UiField` preservam semântica, labels e estados. Não duplicar os adaptadores. |
| Estrutura da instalação | `src/web/portal-view.tsx` | `Portal` hospeda a aplicação. Não remontar o HTML/head em cada página. |
| Navegação e área de conteúdo | `src/web/account/workspace-view.tsx` | `WorkspaceView` é o shell; páginas entregam apenas seu conteúdo. |
| Cabeçalho, filtros, métricas, refresh e skeleton | `src/web/account/workspace-ui.tsx` | Compor os componentes existentes; não criar outro cabeçalho local com escala própria. |
| Filtros e estado vazio | `src/web/account/workspace-filters.tsx` | `ScopeFields`, `FilterActions`, `EmptyView`. |
| Consulta e feedback | `src/web/account/workspace-resource.tsx` | `useResource`, `ResourceFeedback`, datas e links com escopo. |
| Escala e densidade do painel | `src/web/account.css` | Alterar a regra responsável, sem acumular overrides no fim do arquivo. |
| Apresentação específica da auditoria | `src/web/account/audit.css` | Layout de concessões, eventos e medidas; consumir a mesma paleta. |

Os nomes de papéis nas tabelas abaixo são linguagem de design. Somente os tokens
CSS explicitamente marcados como existentes já estão definidos. Não criar um
framework de temas, registry de páginas ou variantes dinâmicas para reproduzi-los.

## 2. Fundamentos visuais

### Cor: semântica antes de decoração

| Papel | Token existente / valor | Uso correto | Evitar |
| --- | --- | --- | --- |
| Fundo | `--page` · `#000000` | Base contínua do workspace. | Alternar fundos por seção sem motivo. |
| Superfície | `--surface` · `#171717` | Filtro, formulário ou grupo de dados relacionado. | Card para toda linha ou frase. |
| Texto | `--text` · `#edece8` | Título, dado e ação legível. | Branco absoluto adicionado localmente. |
| Texto auxiliar | `--muted` · `#adadad` | Metadados, legenda, explicação secundária. | Tornar erro, moeda ou titular indispensável quase invisível. |
| Ação e foco | `--accent` · `#f6821f` | Primário, foco e destino ativo. | Pintar cada subtítulo, número ou ícone de laranja. |
| Linha | `--line` · `#414141` | Separação de registros e controles. | Sombras ou divisórias duplicadas em cada nível. |
| Confirmação | `#c3d7bd` sobre `#263126` | Resultado confirmado, sempre com texto. | Tratar autorização como conexão online. |
| Atenção | `#e4cc96` sobre `#2e291e` | Pendência, parcialidade ou falha acionável, com texto. | Alerta permanente para conteúdo informativo. |

Feedback usa classes já existentes, como `notice`, `status-label`, `run-succeeded`
e `run-failed`. Não introduzir uma cor para cada provedor, pessoa ou modelo. A
cor não substitui rótulos: “Falhou”, “Pendente” e “Modelo não informado” continuam
legíveis em escala de cinza.

### Tipografia: uma família, cinco níveis úteis

| Papel | Tamanho / peso | Aplicação |
| --- | --- | --- |
| Título da página | 28 px no compacto; até 32 px / 600 | Um `h1` por página via `WorkspaceHeading`. |
| Seção | 20 px / 550–600 | Um conjunto de trabalho: transações, concessões ou categorias. |
| Título de registro | 17 px / 550 | Nome de conta, regra, grupo ou perfil. |
| Corpo | 15 px / 400; entrelinha 1,5 | Explicação breve e conteúdo operacional. |
| Controle e tabela | 14 px / 400–550 | Filtros, botões e leitura por linhas. |
| Metadado | 12 px / 400–550 | Data auxiliar, origem e cabeçalho de coluna. |
| Número de resumo | 22 px / 550 | Contagem ou medida real; não competir com a página. |

Hanken Grotesk variável vem de `src/web/assets/fonts/`, servida localmente. Não
carregar Google Fonts. Monoespaçada somente para código, IDs e argumentos. Valores
monetários usam algarismos tabulares e conservam moeda, sinal e precisão; uma
abreviação visual nunca pode alterar o significado de um saldo.

Títulos com tracking negativo moderado. Texto explicativo até 65 caracteres de
largura por linha. Não inventar tamanhos intermediários a cada componente. Um
metadado indispensável à decisão deve subir de hierarquia, não ganhar uma cor nova.

Os tokens operacionais existentes em `.workspace` são `--text-title`,
`--text-section`, `--text-body`, `--text-control`, `--text-caption` e
`--control-height` (44 px). Use a classe/componente antes de aplicar um token local.

### Espaço, geometria e densidade

| Medida | Uso |
| --- | --- |
| 4 px | Relação imediata: metadado sob valor, rótulo dentro de um registro. |
| 8 px | Ícone/texto, botões da mesma tarefa, pequenos grupos. |
| 12 px | Controles vizinhos, célula de tabela, intervalo entre registros compactos. |
| 16 px | Padding de superfície; separação de campos ou partes de um registro. |
| 24 px | Seções e blocos de trabalho diferentes. |
| 32 px | Estrutura principal e espaço entre navegação e conteúdo. |

A escala está disponível em `--space-1`, `--space-2`, `--space-3`,
`--space-4`, `--space-6` e `--space-8` (múltiplos de 4 px).

Controles e summaries têm alvo de **44 × 44 px no mínimo**, mesmo quando o ícone
tem 20 px. Uma linha de dados sem ação não precisa ter altura de botão. Raios:
6 px nos controles, 10 px nos grupos, 4 px nos estados. Sem gradiente, glow,
textura ou sombra decorativa. A linha deve separar; o espaço deve organizar.

No desktop, título e filtros não devem consumir a maior parte da primeira tela.
Em uma viewport de 1280 × 900, o primeiro dado ou a ação principal deve aparecer
sem rolar. Esta é uma meta de composição, não permissão para ocultar alertas reais.
Teste também 390 px e zoom 200%; não crie uma largura mínima no `body`.

## 3. Matriz de ações

| Intenção | Implementação existente | Texto e comportamento | Quando não usar |
| --- | --- | --- | --- |
| Primária | `<UiButton>` ou `variant="primary"` | Verbo específico: “Conectar Meu Pluggy”, “Aplicar filtros”. Uma ação dominante por tarefa. | Atualização auxiliar, link de navegação, ação que ainda pede escolha. |
| Secundária | `<UiButton variant="secondary">` | “Importar esta visão”, “Cancelar”, “Tentar novamente”. Superfície neutra. | Tornar uma ação necessária impossível de encontrar. |
| Ícone | `RefreshButton` | Nome acessível, dica única no foco/hover, ícone Phosphor, alvo 44 px. | “Revogar”, “Conectar” ou qualquer ação cuja consequência não seja óbvia. |
| Destrutiva | Ação secundária → confirmação explícita → `UiButton` com verbo completo | “Revogar acesso” → “Confirmar revogação”, nome do cliente e “Cancelar”. É um padrão de interação; não existe `variant="danger"` no adaptador. | Executar ao abrir disclosure, selecionar linha ou clicar num ícone sem texto. |
| Navegação | `<a href>` | Destino explícito: “Ver transações”, “Mais autorizações”. Preserva comportamento de nova aba/voltar. | Trocar link por botão com `location` sem necessidade. |

Sempre declarar `type="button"` para ação que não submete um formulário.
`UiButton` assume `submit`. Estado `disabled` preserva tamanho e texto; impedir
envio duplicado não substitui idempotência no backend. Não chamar `disabled` de
permissão negada: nesse caso explicar o motivo e a recuperação possível.

## 4. Estados: contrato para toda consulta

| Estado | Componente / padrão | O que o usuário vê |
| --- | --- | --- |
| Primeira carga | `ResourceFeedback` → `WorkspaceSkeleton` | Espaço estável com formas neutras e anúncio “Carregando dados salvos…”. Sem valores fictícios. |
| Atualização da mesma consulta | `useResource` mantém `data`; `ResourceFeedback` anuncia atualização | Registros continuam visíveis. Refresh fica desabilitado durante a consulta. |
| Consulta diferente | Callback `load` estável com dependências corretas | O recorte anterior é limpo; resultados de outra pessoa/filtro não se apresentam como atuais. |
| Vazio válido | `EmptyView` | Título específico e uma saída útil: mudar filtro, conectar ou importar. Não parecer falha. |
| Falha | `ResourceFeedback` | Mensagem com caminhos para tentar novamente, corrigir filtro, reabrir lista ou entrar. Sem stack trace. |
| Dados antigos após falha | Dados preservados + alerta de possível desatualização | O usuário distingue “último resultado” de “atualização concluída”. |
| Parcialidade financeira | `notice` próxima dos resultados | Explica a limitação antes de alguém interpretar o recorte como total. |
| Movimento reduzido | CSS `prefers-reduced-motion: reduce` | Skeleton estático; nenhuma informação depende de animação. |

Skeleton usa pulso discreto de opacidade. Não usar shimmer, contagem animada de
dinheiro, spinner permanente ou transição que atrase uma ação. Estados de espera
não removem o foco da pessoa; confirmações não fazem o scroll saltar sem necessidade.

`useResource` recebe uma função `load(signal)` memoizada com `useCallback`. Incluir
as dependências que mudam o recorte. Não declarar um callback novo em cada render:
isso provoca novas consultas. Consumir o `AbortSignal`; não recuperar falhas com
`catch` ad hoc. O fluxo existente usa `tryCatch` na fronteira de I/O.

## 5. Peças disponíveis: imports e props

Paths de import abaixo assumem uma página dentro de `src/web/account/`.

```tsx
import { UiButton, UiField } from "../ui";
import { EmptyView, FilterActions, ScopeFields } from "./workspace-filters";
import { ResourceFeedback, useResource } from "./workspace-resource";
import {
  FilterBar,
  RefreshButton,
  WorkspaceHeading,
  WorkspaceMetrics,
  WorkspaceSkeleton,
} from "./workspace-ui";
```

| Peça | Props atuais | Uso |
| --- | --- | --- |
| `FilterBar` | `action: string`, `children: ReactNode` | Formulário GET, layout e alinhamento; recebe campos e `FilterActions`. |
| `WorkspaceMetrics` | `items: Array<{ label: string; value: ReactNode; hint?: string }>` | Métricas sem regras financeiras; cada label deve ser único no conjunto. |
| `WorkspaceHeading` | `title: string`, `description?: string`, `children?: ReactNode` | Título e descrição de uma frase; `children` recebe refresh ou uma ação de página. |
| `RefreshButton` | `onClick: () => void`, `disabled?: boolean`, `label?: string` | Label padrão “Atualizar dados”; contextualizar como “Atualizar auditoria”. |
| `WorkspaceSkeleton` | Nenhuma | Preferir acesso por `ResourceFeedback`; uso direto só em estado inicial equivalente. |
| `UiButton` | Props de `Button` Kumo e atributos `data-*`; `variant` padrão `primary` | Padrão visual adaptado. Declarar `type`, `disabled` e ação/submit. |
| `UiField` | Props de `Input` Kumo + `label: string` | ID associado ao label; IDs fornecidos pelo chamador são preservados. |
| `ScopeFields` | `snapshot: PortalResponse`, `catalog: WorkspaceCatalog`, `params: URLSearchParams`, `person?: boolean` | Grupo e pessoa de consultas financeiras. Não usar na auditoria de clientes. |
| `FilterActions` | Nenhuma | Aplicar e limpar filtros; depende de URL da página. Limpar mantém pessoa/grupo ativos. |
| `EmptyView` | `title: string`, `children: ReactNode` | Frase explicativa dentro de `p`; não passar outro bloco de formulário como filho. |
| `useResource<T>` | `load: (signal: AbortSignal) => Promise<T>` | Retorna `data`, `error`, `loading`, `request`, `retry`. |
| `ResourceFeedback` | `error`, `loading`, `retry`, `data?` | Pode receber `{...resource}`; renderizar antes dos resultados. |

`WorkspaceView` é a composição interna do shell: recebe `children`, `api`,
`snapshot`, `command` e `busy`. Não renderizá-lo dentro de outra página do
workspace. Use o ponto de montagem existente em `AccountView` e registre a rota
no controller; um link de menu sozinho não cria uma página autenticada.

## 6. Padrões de layout

### Shell e cabeçalho

Desktop: navegação à esquerda, conteúdo flexível, largura máxima 1480 px.
Mobile: navegação compacta antes do conteúdo. O destino ativo usa
`aria-current="page"`, texto e borda. Link de salto aponta ao conteúdo.
`WorkspaceHeading` mantém título à esquerda e ação à direita quando houver largura.
Não repetir título em eyebrow, descrição da navegação e outra legenda.

### Filtros

Usar `FilterBar`, que renderiza `<form method="get">` e `.workspace-filters`. O URL conserva o recorte para
atualizar, compartilhar localmente e voltar. Grupo/pessoa + busca são principais;
datas, conta, categoria e estado podem ficar em `.advanced-filters`. Se um filtro
avançado estiver ativo, abrir o disclosure. Labels são permanentes; placeholder é
exemplo, não instrução obrigatória. Aplicar aparece perto dos campos.

### Tabela financeira

Usar `.ledger-wrap` e `.ledger`, `caption` acessível, cabeçalhos `th` e `data-label`
nas células que viram registros no mobile. Dinheiro alinhado à direita; datas e
metadados podem quebrar sem alterar números. Origem/IDs ficam em `.row-details`.
Paginação em `.pagination`: recorte, próximo lote e retorno ao início. Nunca usar
a soma dos registros da página como total financeiro do período.

### Cards e listas

`.account-grid` + `.bank-account` agrupam saldo, titular e origem de uma conta.
`.group-grid` + `.group-card` agrupam um espaço e suas relações. Registros repetidos
como regras e sincronizações usam `.rule-list` / `.run-list` e linhas separadas;
não precisam de um card decorativo por item. Uma lista de dez identidades não vira
um mosaico de dez indicadores. Preserve componentes de domínio em vez de um
`UniversalCard` com dezenas de flags.

### Métricas e auditoria

`WorkspaceMetrics` monta um `dl` de contagens/medidas reais; a auditoria mostra até
quatro medidas comparáveis no topo. Definição em `dt`, número em `dd`, qualificação em
`small`; não encaixar títulos no próprio número. Gráfico só quando mostra mudança
ou distribuição relevante. A atividade diária mantém contagens em texto e período
explícito; uma barra sem legenda e sem escala útil é decoração.

Auditoria separa **concessão**, **cliente**, **chamada** e **modelo informado**.
Nome declarado não é identidade verificada. Acesso vigente não significa “online”.
Bytes de corpo do Worker não são tokens ou custo de IA. Taxa de erro mostra
denominador, escopo e janela; “Não informado” é resultado válido. Detalhes técnicos
ficam em disclosure, mas limitações necessárias à interpretação ficam junto à medida.

## 7. Três receitas de página

São trechos de composição para páginas existentes; `snapshot`, `api`, `params`,
`resource`, `data` e handlers vêm do controller/hook da página. Não são outro
framework nem um modelo de domínio alternativo.

### Receita A — leitura com filtros e resultados

Base completa: `transactions-view.tsx`. `resource` vem do `useResource(load)`;
`data.catalog` é o catálogo já validado na fronteira.

```tsx
<>
  <WorkspaceHeading
    description="Lançamentos por titular, conta e categoria, na moeda de origem."
    title="Transações"
  />
  <ResourceFeedback {...resource} />
  {!!data && (
    <>
      <FilterBar action="/account/transactions">
        <ScopeFields catalog={data.catalog} params={params} snapshot={snapshot} />
        <label>
          Buscar descrição
          <input defaultValue={params.get("q") ?? ""} name="q" type="search" />
        </label>
        <FilterActions />
      </FilterBar>
      {/* Tabela do domínio, estado vazio e paginação existentes. */}
    </>
  )}
</>
```

Não duplicar na página consultas financeiras, cálculo monetário ou regras de
classificação. A interface apresenta o contrato do backend.

### Receita B — gestão com uma ação principal

Base completa: `dashboard-view.tsx` e `household-view.tsx`. `busy` representa a
ação pendente; `connect` e `importSelection` são handlers locais já validados.

```tsx
<>
  <WorkspaceHeading
    description="Pessoas, perfis Pluggy e acesso aos bancos."
    title="Conexões"
  />
  <section aria-labelledby="connection-actions">
    <div className="section-heading">
      <h2 id="connection-actions">Conexões e atualização</h2>
      <UiButton disabled={busy} onClick={importSelection} type="button" variant="secondary">
        Importar esta visão
      </UiButton>
    </div>
    <form onSubmit={connect}>
      {/* Perfil e titular explícitos; campos reais da implementação existente. */}
      <UiButton disabled={busy} type="submit">Conectar Meu Pluggy</UiButton>
    </form>
  </section>
</>
```

Credenciais ficam em disclosure e nunca voltam em texto preenchido do servidor.
Confirmar um formulário não deve remover a relação entre titular e origem.

### Receita C — diagnóstico com atualização e recorte temporal

Base completa: `audit-view.tsx`. Refresh é auxiliar e cabe no cabeçalho. A página
explica a janela e mantém limites de medição junto às tabelas.

```tsx
<>
  <WorkspaceHeading
    description="Autorizações e atividade observada nesta instalação."
    title="Auditoria MCP"
  >
    <RefreshButton
      disabled={resource.loading || busy}
      label="Atualizar auditoria"
      onClick={resource.retry}
    />
  </WorkspaceHeading>
  <ResourceFeedback {...resource} />
  {!!data && (
    <>
      <WorkspaceMetrics items={[
        { label: "Requisições autenticadas", value: data.totals.requests },
        { label: "Falhas", value: data.totals.errors, hint: "No período selecionado" },
      ]} />
      {/* Recorte temporal e concessões do contrato AuditReport. */}
      <section aria-labelledby="models-heading">
        <h2 id="models-heading">Modelos informados pelos clientes</h2>
        <p className="muted">Nome declarado pelo cliente; não verificado pelo servidor.</p>
        {/* Tabela real com chamadas, falhas, denominador e volume. */}
      </section>
    </>
  )}
</>
```

Não calcular taxa por modelo usando todas as requisições como denominador. Não
apresentar interrupção como sucesso, nem HTTP 200 como prova de ferramenta concluída.

## 8. Critérios de acessibilidade e revisão

1. **Estrutura e teclado:** um `h1`, seções identificadas, ordem de foco coerente,
   skip link funcional, foco visível e nenhuma armadilha. Abrir/fechar disclosures
   e confirmar/cancelar sem mouse. Foco não fica em conteúdo removido após revogação.
2. **Nome e alvo:** controles com label acessível, ícones decorativos ocultos para
   leitura, alvos 44 px, dicas acessíveis no foco. Placeholder não substitui label;
   cor não substitui resultado. Links dizem destino ou consequência.
3. **Leitura e zoom:** contraste mínimo de referência 4,5:1 para texto comum e 3:1
   para texto grande/limites essenciais; medir as combinações reais, não deduzir da
   paleta. A 200% e em 390 px, nenhuma ação fica cortada. Tabela técnica pode rolar
   em um contêiner identificado; a página inteira não deve rolar horizontalmente.
4. **Estados e confiança:** carga inicial, vazio, parcial, erro e atualização testados;
   `role="status"` para espera/sucesso e `role="alert"` para falha. Valores anteriores
   não parecem recentes. Movimento reduzido funciona; alertas não somem por timeout
   antes de serem lidos. Período, moeda e denominador estão explícitos.
5. **Implementação e evidência:** reutilizar as peças atuais, revisar desktop/mobile,
   comparar captura anterior/final, executar `mise run check:quick` e checks relevantes.
   O agente que entrega executa `mise run check`. Registrar limites: local/sintético
   não equivale a OAuth real, produção ou execução em um cliente MCP.

## 9. Referências visuais e o limite da inspiração

O [relatório crítico](design-critical-review.md) identifica fontes oficiais e
capturas desta rodada. O painel Dinzo demonstra título de página compacto, barra
de ações e agrupamentos nomeados. A landing do Visor demonstra uma hierarquia
clara entre CTA principal/secundário, porém seu hero e suas ilustrações pertencem
à aquisição, não à operação. A imagem de dashboard publicada na documentação Securo aproxima medidas,
composição de gastos e registros em uma tela; a documentação informa a relação
entre controle de dados e agentes. Não copiar fonte, paleta, ícones proprietários,
gradientes, mascote, copy ou estrutura de marca dos concorrentes.

O equivalente visual do Caderninho deve usar os próprios componentes renderizados:
botões, campos, título, filtros, linha financeira, métrica, estados e disclosure.
A página `/account/design-system` usa essas peças reais, com dados explicitamente
fictícios; não um HTML paralelo que possa divergir do produto. A receita correta
é a que um desenvolvedor consegue reutilizar sem reimplementar sua aparência.


## 8. Composição pública: landing e login

`src/web/public-layout.tsx` fornece o shell das páginas públicas e de acesso.
Ele consome `Document`/`DesignHead` e `UiLink` de `src/web/ui.tsx`; login reutiliza
`UiField` e `UiButton`. Não levar seletores do `Portal` para estas páginas: seus
respiros e sua hierarquia de aquisição são diferentes dos do workspace.

| Peça | Uso |
| --- | --- |
| `PublicLayout({ title, description, access?, children })` | Documento, marca, navegação, rodapé e estilos de apresentação. `access` reduz navegação durante o login. |
| `UiLink` | Destino de navegação com as mesmas variantes visuais de `UiButton`; permanece um link real. |
| `.public-surface` | Um grupo principal com padding 24–28 px, raio 10 px e sombra neutra delimitada ao shell público. |
| `.public-reveal` | Entrada única de 400 ms, até 8 px; apenas em conteúdo de apresentação. Nunca esconder erro/senha para animar. |
| `.access-form` | Formulário nativo, senha com autocomplete, label, origem visível, erro associado e uma submissão principal. |

A exceção de sombra e movimento foi autorizada pelo usuário para landing/login;
a regra de sobriedade do dashboard permanece. Ver `DESIGN.md` e
[public-pages-qa.md](public-pages-qa.md) para jornadas e evidências.
