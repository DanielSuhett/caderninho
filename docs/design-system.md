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
| Cores e elevação | `src/web/design-tokens.ts` | Fonte única de `colorTokens` e `shadowTokens`, também usada pela galeria. |
| Fonte local, publicação dos tokens e foco global | `src/web/design.tsx` | `DesignHead` publica as chaves como variáveis CSS; não importar outra fonte ou tema. |
| Botão, link e campo Kumo | `src/web/ui.tsx` | `UiButton`, `UiLink` e `UiField` preservam semântica, labels e estados. Não duplicar os adaptadores. |
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

Todas as variáveis abaixo existem em `src/web/design-tokens.ts`. A camada CSS usa
`var(--nome)`; a galeria importa os objetos para apresentar valores. Não duplicar
hexadecimais nos componentes nem criar um framework de temas.

| Papel | Tokens / valores | Uso correto |
| --- | --- | --- |
| Fundo | `--page` · `#000000` | Base contínua; não alternar fundos por seção sem motivo. |
| Superfície | `--surface` · `#171717` | Filtro, formulário ou grupo de dados relacionado. |
| Superfície elevada | `--surface-raised` · `#242424` | Conteúdo sobreposto, como tooltip; não é fundo de todo card. |
| Texto principal | `--text` · `#edece8` | Título, dado e ação legível. |
| Texto auxiliar | `--muted` · `#adadad` | Metadados e explicação secundária; informação decisiva continua explícita. |
| Separador | `--line` · `#414141` | Organização visual entre registros; não é a borda essencial de um campo. |
| Limite de controle | `--control-border` · `#858585` | Identificação dos controles sobre neutros, inclusive hover/pressionado. |

### Ação, seleção e estados de controle

| Papel | Tokens / valores | Contrato |
| --- | --- | --- |
| Primário / foco | `--accent` · `#f6821f`; `--on-accent` · `#17100a` | Texto escuro no botão laranja; foco com outline visível. |
| Primário hover / pressionado | `--accent-hover` · `#ff9d4d`; `--accent-pressed` · `#de7016` | Preservar `--on-accent`; não usar opacidade no componente inteiro. |
| Neutro hover / pressionado | `--surface-hover` · `#303030`; `--surface-pressed` · `#383838` | Texto principal e borda de controle permanecem legíveis. |
| Seleção | `--selected-bg` · `#332316`; `--selected-text` · `#ffc291` | Destino ativo, pessoa selecionada e seleção de texto; não confundir com sucesso. |
| Desabilitado | `--disabled-bg` · `#242424`; `--disabled-text` · `#969696` | Tamanho e texto preservados, sem sombra ou movimento; explicar bloqueios quando necessário. |
| Destrutivo hover / pressionado | `--danger-hover` · `#46292b`; `--danger-pressed` · `#543133` | Texto e borda da família erro. Cor não substitui confirmação. |

`UiButton` e `UiLink` usam os estados centrais. Ambos mapeiam as variantes públicas
`primary` e `secondary` para `outline` do Kumo; as demais variantes são preservadas.
As classes do Caderninho definem as cores, incluindo destrutivo e desabilitado,
sem disputar com as cores obrigatórias das outras variantes da biblioteca. Isso
mantém a semântica Kumo e evita seu gradiente. Hover não pode ser a única forma
de descobrir uma ação. O foco permanece laranja, inclusive no destrutivo. Transições de controles
são de 150 ms e são removidas com movimento reduzido.

Seleção de navegação usa `aria-current="page"`; seleção de pessoa usa
`aria-pressed="true"`. Fundo e texto de seleção acompanham a borda/marcador laranja.
`::selection` usa o mesmo par, mas não altera a seleção lógica da aplicação.
Campos inválidos recebem `aria-invalid="true"` e borda de erro, com mensagem
associada; placeholder não substitui label nem mensagem de validação.

### Feedback e estados do domínio

| Tom | Texto / fundo / borda | Significado e aliases |
| --- | --- | --- |
| Sucesso | `--success-text` `#c3d7bd` / `--success-bg` `#263126` / `--success-border` `#7b9674` | Resultado confirmado; `run-succeeded`, `sync-succeeded`. |
| Atenção | `--warning-text` `#e4cc96` / `--warning-bg` `#2e291e` / `--warning-border` `#a28b58` | Pendência ou parcialidade; `run-pending`, `sync-pending`. |
| Erro | `--error-text` `#f1aaa4` / `--error-bg` `#331f20` / `--error-border` `#b57873` | Falha acionável; `run-failed`, `sync-failed`. |
| Informação | `--info-text` `#b4cae8` / `--info-bg` `#1d2938` / `--info-border` `#7a94b5` | Atualização e execução em andamento; padrão das classes de feedback. |
| Neutro | `--muted` / `--surface` / `--line` | Estado descritivo: regra ativa, registro contabilizado ou acesso vigente. |

Use `data-tone="success|warning|error|info|neutral"` em `notice`, `status-label`
ou `sync-state`. Essas classes consomem `--tone-text`, `--tone-bg` e
`--tone-border`; os aliases de execução/sincronização mapeiam para a mesma paleta.
Sem atributo, o padrão é informação. A aplicação deve escolher o tom pelo estado
estruturado, nunca por busca de palavras dentro da mensagem. Não combinar um alias
contraditório com `data-tone` para tentar corrigir o resultado por ordem do CSS.

```tsx
<p className="notice" data-tone="warning" role="status">
  A importação está parcial. Os registros já confirmados continuam disponíveis.
</p>
<span className="status-label run-failed">Falhou</span>
<span className="sync-state" data-tone="info">Em andamento</span>
```

A cor não substitui rótulos: “Falhou”, “Pendente” e “Modelo não informado” continuam
legíveis em escala de cinza. Não introduzir uma cor por provedor, pessoa ou modelo.
Autorização vigente não comprova conexão online; regra ativa não é resultado de
sincronização; “Não informado” não é automaticamente falha. Mensagem de erro usa
`role="alert"` quando precisa ser anunciada; espera/sucesso usam `role="status"`.

### Contraste calculado dos pares

Valores calculados pela luminância relativa sRGB dos tokens opacos, arredondados
somente para exibição. Referências: [texto comum 4,5:1 e texto grande 3:1](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html),
[limites e gráficos essenciais 3:1](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
e [significado independente de cor](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).
Um separador decorativo não tem o mesmo papel de um limite essencial de controle.

| Par | Razão calculada |
| --- | --- |
| Texto / superfície; auxiliar / superfície | 15,17:1; 7,99:1 |
| Texto do primário / normal, hover, pressionado | 7,29:1; 9,13:1; 5,77:1 |
| Texto de seleção / fundo de seleção | 9,61:1 |
| Texto desabilitado / fundo desabilitado | 5,25:1 |
| Borda de controle / superfície, elevada, hover, pressionada | 4,86:1; 4,21:1; 3,58:1; 3,18:1 |
| Sucesso, atenção, erro, informação: texto / próprio fundo | 8,89:1; 9,21:1; 8,12:1; 8,80:1 |
| Sucesso, atenção, erro, informação: borda / próprio fundo | 4,17:1; 4,39:1; 4,35:1; 4,72:1 |
| Texto de erro / destrutivo hover, pressionado | 6,84:1; 5,92:1 |

Esses cálculos não comprovam conformidade de uma página inteira. Opacidade,
sobreposição, fundo adjacente, foco e estados renderizados exigem revisão na UI.
A linha `#414141` sobre `#171717` tem 1,76:1: adequada como separador decorativo,
não como único indício de um campo. Sombra não corrige contraste.

### Séries e gráficos

| Série | Token / valor | Contraste sobre `--surface` |
| --- | --- | --- |
| 1 | `--chart-1` · `#a6bfdc` | 9,48:1 |
| 2 | `--chart-2` · `#9ac8bd` | 9,71:1 |
| 3 | `--chart-3` · `#c4b5da` | 9,36:1 |
| 4 | `--chart-4` · `#d7bd91` | 9,88:1 |

São cores categóricas, não estados de saúde. Não usar vermelho para toda saída
financeira ou verde para toda entrada; sinal, moeda e rótulo carregam o significado.
Uma série pode usar `--chart-1`; múltiplas séries precisam de legendas, rótulos,
posições ou padrões distinguíveis. O contraste com o fundo acima **não** demonstra
contraste entre séries. Evitar segmentos adjacentes dependentes apenas de cor.
Sempre manter valores em texto, período e unidade; disponibilizar os dados sem
hover e não atribuir precisão inexistente a volume, custo ou tokens de IA.

### Superfície e elevação

| Nível | Token / valor | Aplicação |
| --- | --- | --- |
| Plano | `--shadow-flat` · `none` | Linhas, tabelas, métricas e estrutura comum. |
| Baixo | `--shadow-low` · `0 2px 6px #0005, inset 0 1px 0 #ffffff08` | Filtros, grupos/contas e editor de perfil aberto. |
| Elevado | `--shadow-raised` · `0 8px 24px #0008, inset 0 1px 0 #ffffff0c` | Tooltip sobre a página, com `--surface-raised`. |
| Público | `--shadow-public` · `0 16px 48px #0009, inset 0 1px 0 #ffffff0c` | Grupo principal de landing/login, com `--surface`. |

A elevação sinaliza agrupamento ou sobreposição. Não adicionar sombra em toda
célula nem empilhar níveis em um card dentro de outro. O fundo, a borda e o espaço
continuam responsáveis pela leitura; sombras pretas no fundo preto não bastam para
delimitar componentes. O painel pode usar profundidade baixa sem competir com seus
dados. Não criar glow laranja, gradiente ou sombra colorida de estado.

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
textura ou sombra fora dos níveis definidos acima. A linha deve separar; o espaço deve organizar.

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
| Destrutiva | Ação secundária → confirmação explícita → `<UiButton tone="danger">` | “Revogar acesso” → “Confirmar revogação”, nome do cliente e “Cancelar”. `tone` muda a semântica visual sem criar `variant="danger"` no Kumo. | Executar ao abrir disclosure, selecionar linha ou clicar num ícone sem texto. |
| Navegação | `<a href>` ou `UiLink` para CTA | Destino explícito: “Ver transações”, “Mais autorizações”. Preserva comportamento de nova aba/voltar. | Trocar link por botão com `location` sem necessidade. |

Sempre declarar `type="button"` para ação que não submete um formulário.
`UiButton` assume `submit`. Estado `disabled` preserva tamanho e texto; impedir
envio duplicado não substitui idempotência no backend. Não chamar `disabled` de
permissão negada: nesse caso explicar o motivo e a recuperação possível.

```tsx
<UiButton disabled={busy} onClick={revoke} tone="danger" type="button" variant="secondary">
  Confirmar revogação
</UiButton>
```

Esse botão pertence ao estado de confirmação que já identifica o cliente e oferece
cancelamento. `tone="danger"` usa a família erro e seus estados próprios;
`variant` continua aceitando as variantes reais da biblioteca. `UiLink` não tem
prop `tone`: revogação é ação, não navegação.

## 4. Estados: contrato para toda consulta

| Estado | Componente / padrão | O que o usuário vê |
| --- | --- | --- |
| Primeira carga | `ResourceFeedback` → `WorkspaceSkeleton` | Espaço estável com formas neutras e anúncio “Carregando dados salvos…”. Sem valores fictícios. |
| Atualização da mesma consulta | `useResource` mantém `data`; `ResourceFeedback` anuncia atualização | Registros continuam visíveis. Refresh fica desabilitado durante a consulta. |
| Consulta diferente | Callback `load` estável com dependências corretas | O recorte anterior é limpo; resultados de outra pessoa/filtro não se apresentam como atuais. |
| Vazio válido | `EmptyView` | Título específico e uma saída útil: mudar filtro, conectar ou importar. Não parecer falha. |
| Falha | `ResourceFeedback` | Mensagem com caminhos para tentar novamente, corrigir filtro, reabrir lista ou entrar. Sem stack trace. |
| Dados antigos após falha | Dados preservados + alerta de possível desatualização | O usuário distingue “último resultado” de “atualização concluída”. |
| Parcialidade financeira | `notice` com `data-tone="warning"` próxima dos resultados | Explica a limitação antes de alguém interpretar o recorte como total. |
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
import { UiButton, UiField, UiLink } from "../ui";
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
| `UiButton` | Props de `Button` Kumo, atributos `data-*`, `tone?: "normal" \| "danger"`; `variant` padrão `primary` | Tom padrão `normal`; declarar `type`, `disabled` e ação/submit. |
| `UiLink` | Props de `LinkButton` Kumo; `variant` padrão `primary` | Navegação real com `href`, sem prop `tone`. |
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


## 10. Composição pública: landing e login

`src/web/public-layout.tsx` fornece o shell das páginas públicas e de acesso.
Ele consome `Document`/`DesignHead` e `UiLink` de `src/web/ui.tsx`; login reutiliza
`UiField` e `UiButton`. Não levar seletores do `Portal` para estas páginas: seus
respiros e sua hierarquia de aquisição são diferentes dos do workspace.

| Peça | Uso |
| --- | --- |
| `PublicLayout({ title, description, access?, children })` | Documento, marca, navegação, rodapé e estilos de apresentação. `access` reduz navegação durante o login. |
| `UiLink` | Destino de navegação com as mesmas variantes visuais de `UiButton`; permanece um link real. |
| `.public-surface` | Um grupo principal com padding 24–28 px, raio 10 px e `--shadow-public`; elevação baixa continua disponível no workspace. |
| `.public-reveal` | Entrada única de 400 ms, até 8 px; apenas em conteúdo de apresentação. Nunca esconder erro/senha para animar. |
| `.access-form` | Formulário nativo, senha com autocomplete, label, origem visível, erro associado e uma submissão principal. |

Landing/login usam a elevação pública e entrada única; o workspace usa os níveis
planos/baixos e tooltip elevado. Todo movimento respeita `prefers-reduced-motion`.
Ver `DESIGN.md` e
[public-pages-qa.md](public-pages-qa.md) para jornadas e evidências.
