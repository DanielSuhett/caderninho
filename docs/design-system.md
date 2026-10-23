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
| Campos de escopo e estado vazio | `src/web/account/workspace-filters.tsx` | `ScopeFields` e `EmptyView`; aplicação/limpeza pertencem a `FilterDrawer`. |
| Drawer modal compartilhado | `src/web/account/workspace-drawer.tsx` | `WorkspaceDrawer`: diálogo nativo, cabeçalho, corpo rolável e ações Kumo. |
| Editor de backoffice | `src/web/account/backoffice-dialog.tsx` | Drawer de 720 px, cabeçalho/ações fixos, corpo rolável, confirmação de descarte e foco restaurado. |
| Item expansível compartilhado | `src/web/account/disclosure-item.tsx` | `DisclosureItem` fornece interação nativa; os domínios montam resumo e detalhe. |
| Lista financeira | `src/web/account/transaction-list.tsx` | `TransactionList` compõe a peça comum com dados financeiros e a mesma apresentação na galeria. |
| Identificação visual de banco | `src/web/account/bank-mark.tsx` | `BankMark` e catálogo `bankMarks`; fallback neutro sem identidade confirmada. |
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

Seleção de navegação usa `aria-current="page"`; pessoa é selecionada no campo
nativo do drawer e aparece no resumo aplicado. Fundo e texto de seleção distinguem
os destinos ativos, sem faixa ou borda lateral colorida.
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

### Gramática das bordas

| Peça | Limite | Regra |
| --- | --- | --- |
| Lista, métrica e detalhe | `--line` | Um traço horizontal entre partes; sem moldura por registro nem linha duplicada na entrada. |
| Campo, botão e ação paginada | `--control-border` | Contorno uniforme do controle, com foco por outline independente. |
| Aviso e estado | `--*-border` | Contorno semântico de 1 px em todos os lados; texto e fundo nomeiam o estado. |
| Superfície de grupo e drawer | `--line` quando necessário | Fundo e espaço agrupam primeiro; borda completa só quando separa uma superfície real. |

Etiquetas informativas usam `--surface` e raio de 4 px, sem um contorno para cada
palavra. A rota ativa usa fundo, texto e `aria-current`, sem faixa laranja lateral.
O drawer mantém sua linha vertical de entrada por ser uma sobreposição. Não usar
bordas laterais coloridas em notas, gráficos, navegação ou mensagens. Esta regra
vale para painel, landing, login, consentimento e 404 do site.

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
| Baixo | `--shadow-low` · `0 2px 6px #0005, inset 0 1px 0 #ffffff08` | Editor de perfil aberto; listas de registros e formulário dentro de drawer são planos. |
| Elevado | `--shadow-raised` · `0 8px 24px #0008, inset 0 1px 0 #ffffff0c` | Tooltip sobre a página, com `--surface-raised`. |
| Profundidade ampla | `--shadow-public` · `0 16px 48px #0009, inset 0 1px 0 #ffffff0c` | Grupo principal de landing/login e drawers modais, com `--surface`. |

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
import { EmptyView, ScopeFields } from "./workspace-filters";
import { ResourceFeedback, useResource } from "./workspace-resource";
import {
  FilterDrawer,
  RefreshButton,
  WorkspaceHeading,
  WorkspaceMetrics,
  WorkspaceSkeleton,
} from "./workspace-ui";
import { WorkspaceDrawer } from "./workspace-drawer";
import { BankMark } from "./bank-mark";
import { DisclosureItem } from "./disclosure-item";
import { TransactionList } from "./transaction-list";
```

| Peça | Props atuais | Uso |
| --- | --- | --- |
| `FilterDrawer` | `action: string`, `children: ReactNode`, `summary: string[]` | Gatilho, recorte aplicado, formulário GET em drawer e limpeza completa pelo caminho sem query. |
| `WorkspaceDrawer` | `title: string`, `trigger: ReactNode`, `children: ReactNode`, `footer?: ReactNode`, `side?: "left" \| "right"`, `className?: string` | Lado padrão direito; `footer` acrescenta a ação primária ao fechamento nativo do componente. |
| `DisclosureItem` | `summary: ReactNode`, `children: ReactNode`, `className?: string` | `details/summary` nativos; chevron decorativo e aparência compartilhada. Não recebe esquema de colunas, seleção ou fetch. |
| `TransactionList` | `records: Transaction[]`, `accounts: Array<{ id: string; name: string }>`, `categories: Array<{ id: string; name: string }>` | `Transaction` deriva dos registros de `TransactionListSchema`; formata valores e compõe `DisclosureItem`. |
| `BankMark` | `institution?: string` | Chave estável do catálogo local; ausente/desconhecida gera BankIcon neutro. |
| `WorkspaceMetrics` | `items: Array<{ label: string; value: ReactNode; hint?: string }>` | Métricas sem regras financeiras; cada label deve ser único no conjunto. |
| `WorkspaceHeading` | `title: string`, `description?: string`, `children?: ReactNode` | Título e descrição de uma frase; `children` recebe refresh ou uma ação de página. |
| `RefreshButton` | `onClick: () => void`, `disabled?: boolean`, `label?: string` | Label padrão “Atualizar dados”; contextualizar como “Atualizar auditoria”. |
| `WorkspaceSkeleton` | Nenhuma | Preferir acesso por `ResourceFeedback`; uso direto só em estado inicial equivalente. |
| `UiButton` | Props de `Button` Kumo, atributos `data-*`, `tone?: "normal" \| "danger"`; `variant` padrão `primary` | Tom padrão `normal`; declarar `type`, `disabled` e ação/submit. |
| `UiLink` | Props de `LinkButton` Kumo; `variant` padrão `primary` | Navegação real com `href`, sem prop `tone`. |
| `UiField` | Props de `Input` Kumo + `label: string` | ID associado ao label; IDs fornecidos pelo chamador são preservados. |
| `ScopeFields` | `snapshot: PortalResponse`, `catalog: WorkspaceCatalog`, `params: URLSearchParams`, `person?: boolean` | Grupo e pessoa de consultas financeiras. Não usar na auditoria de clientes. |
| `EmptyView` | `title: string`, `children: ReactNode` | Frase explicativa dentro de `p`; não passar outro bloco de formulário como filho. |
| `useResource<T>` | `load: (signal: AbortSignal) => Promise<T>` | Retorna `data`, `error`, `loading`, `request`, `retry`. |
| `ResourceFeedback` | `error`, `loading`, `retry`, `data?` | Pode receber `{...resource}`; renderizar antes dos resultados. |

`WorkspaceView` é a composição interna do shell: recebe `children`, `api`,
`snapshot`, `command` e `busy`. Não renderizá-lo dentro de outra página do
workspace. Use o ponto de montagem existente em `AccountView` e registre a rota
no controller; um link de menu sozinho não cria uma página autenticada.

## 6. Padrões de layout

### Shell e cabeçalho

Navegação sempre lateral. Desktop: coluna de 208 px com ícone e nome; compacto,
até 760 px: faixa de 56 px com ícones e conteúdo flexível ao lado. O rail não pode
rolar horizontalmente; filhos e coluna de conteúdo precisam poder encolher.
`WorkspaceHeading` mantém título e ação próximos sem reservar altura de hero.
Não repetir título em eyebrow, descrição da navegação e outra legenda.

Cada destino é um link real com `aria-label`, ícone Phosphor de 20 px oculto da
leitura assistiva, e `aria-current="page"` quando ativo. `title` pode complementar,
mas não é a única forma de descobrir o nome por toque: “Abrir navegação” abre um
`WorkspaceDrawer side="left"` com nomes completos. Preserve o link de salto e
alvos mínimos de 44 px. Não usar `role="menu"` para navegação comum nem trocar a
lateral por grade superior, abas ou barra inferior nas telas estreitas.


#### Grade geométrica da navegação

Os valores abaixo são o contrato a medir em CSS px, não uma declaração de que a
captura ou o browser atual já passou. Aplicar a mesma regra `.sidebar-control` aos
links de destino, Referência visual e botão Kumo Sair. O gatilho “Abrir navegação”
compartilha suas dimensões; estilos gerais de botões não podem reintroduzir padding
ou alinhamento diferente por especificidade. Todos esses alvos têm `margin: 0`;
margens globais de botão não podem somar espaço ao gap da grade.

| Medida | Compacto, até 760 px | Desktop, acima de 760 px |
| --- | --- | --- |
| Coluna lateral | 56 px | 208 px |
| Padding lateral da sidebar | 6 px | 6 px |
| Alvo de navegação | 44 × 44 px, padding zero | 196 × 44 px, padding horizontal de 12 px |
| Ícone | 20 × 20 px, centralizado | 20 × 20 px em coluna própria |
| Centro X do ícone | `sidebar.left + 28` | `sidebar.left + 28` |
| Texto | Oculto no rail; disponível no drawer | Coluna flexível após intervalo de 12 px; início em `sidebar.left + 50` |
| Intervalo entre alvos | 4 px | 4 px |
| Intervalo para o conteúdo | 16 px | 24 px |

Para o topo compacto, o alvo do menu precede os sete destinos com intervalo de
12 px. Após o último destino, o rodapé tem `margin-top: 16px`, separador de 1 px
e `padding-top: 12px`; Referência e Sair têm intervalo de 4 px. O separador ocupa
a largura interna (44 px no rail), fora das áreas acionáveis. Metadados da
instalação aparecem depois das ações e ficam ocultos no rail.

Padding vertical de 6 px e margem vertical de -6 px na sidebar reservam espaço
para foco sem deslocar o primeiro alvo em relação ao topo de `WorkspaceHeading`.
Outline de 2 px com offset de 3 px precisa permanecer visível, sem corte pelo
contêiner rolável. A seleção não usa marcador interno, borda unilateral ou sombra.
Fundo e texto indicam a rota atual; outline laranja aparece no foco de teclado.

O drawer conserva os nomes e a grade de ícone + texto, com itens de 44 px de altura
ocupando a largura interna disponível. Seu padding externo vem de `.drawer-body`;
não herdar a largura de 44 px nem esconder labels por estar dentro da sidebar.
Menu principal, referência e saída devem manter a mesma coordenada X de ícone
dentro do painel. Botões Fechar/Cancelar do drawer conservam seu papel separado.

Consolidar os seletores da navegação por responsabilidade. Em 760 px usar rail;
em 761 px usar sidebar aberta. Em 1000 e 1001 px a geometria interna e o intervalo
para o conteúdo continuam iguais: não existe mais breakpoint exclusivo de 1000 px.
O cabeçalho externo segue o padding do `main`; não deslocar a sidebar para alinhar
ícones pela forma óptica do wordmark.

Antes de aprovar, medir `getBoundingClientRect()` dos alvos e SVGs depois de
estabilizar animações, além de padding/grid computados. Comparar menu, sete
destinos, referência e saída; tolerância máxima de 0,5 CSS px entre centros que
deveriam coincidir. Repetir com drawer aberto e em 390, 564, 760, 761, 1000, 1001
e 1280 px, considerando o viewport real informado pelo DOM. Conferir também
intervalos verticais, foco e rolagem em altura reduzida. `scrollWidth === clientWidth`
é requisito separado: pode passar mesmo com centros e alvos desalinhados.

### Filtros e recorte aplicado

`FilterDrawer` substitui a barra de formulário na página. Todas as oito páginas do
workspace usam a mesma composição, inclusive a galeria fictícia. O conteúdo da
página mantém apenas gatilho “Filtros”, lista `summary` do recorte aplicado e link
“Limpar filtros”. O resumo deve identificar pessoa/grupo/período relevantes e
condições extras; não mostrar somente uma contagem que esconda de quem são os dados.
Os rótulos são descritivos, não chips removíveis, e derivam da URL aplicada.

O drawer recebe os campos existentes (`ScopeFields`, busca, datas e estados).
Não passar `FilterActions`: aplicação e limpeza já são responsabilidade do
`FilterDrawer`. Os controles ficam em uma coluna, com labels permanentes. Não
reintroduzir “Mais filtros” como disclosure aninhado. Campos de busca mantêm nomes
do contrato: transações usam `text`; regras usam `q`.

O formulário GET conserva a URL como fonte da consulta. Mudanças são rascunho até
“Aplicar filtros”; não disparar consultas a cada tecla. X, Escape e “Cancelar”
fecham sem aplicar. O corpo é desmontado ao fechar e reaberto com valores da URL.
Não incluir o cursor antigo no formulário: uma mudança de recorte recomeça a
paginação. Voltar no navegador deve recuperar a consulta anterior.

“Limpar filtros” navega para `action` sem query e remove **todos** os parâmetros,
inclusive pessoa, grupo e cursor; cada página retoma seus padrões (por exemplo,
grupo pessoal e todas as pessoas). Isso é diferente dos links de navegação
`scopedHref`, que conservam pessoa/grupo ao mudar de página. Se a semântica mudar,
atualizar texto, componente e documentação juntos.

### Contrato do drawer

`WorkspaceDrawer` usa `<dialog>` nativo e `showModal()`, sem adicionar outra
biblioteca de componentes. O navegador fornece modalidade, fundo inerte e
contenção de foco; validar esses comportamentos e retorno ao gatilho na jornada.
Título visível associado por `aria-labelledby`; botão X com nome acessível,
Escape e ação de fechamento no rodapé. Navegação usa “Fechar menu”; filtros usam
“Cancelar” e recebem “Aplicar filtros” em `footer`.

À direita, largura `min(440px, 100vw)`; até 480 px ocupa a largura inteira.
À esquerda, navegação com `min(300px, 100vw)`. Altura `100dvh`, cabeçalho e rodapé
fixos na composição flex; só o corpo rola. Teclado virtual não deve ocultar os
campos ou impedir acesso às ações. Backdrop escuro e superfície neutra separam o
painel; não empilhar drawers. Entrada única de 180 ms, removida com
`prefers-reduced-motion`. Nenhuma informação depende da animação.

Ao testar, abrir por teclado/toque, percorrer campos, rolar até o final, cancelar,
reabrir e aplicar. O resumo externo deve continuar representando dados aplicados
durante a edição. Ver [padrão modal WAI](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
para foco e semântica; utilizar diálogo nativo não equivale a homologar a jornada.

### Lista de transações

Usar `TransactionList` tanto na página quanto na galeria. Lista sem cards, borda
apenas entre registros e `DisclosureItem` compartilhado. Toda a linha é o alvo; o
chevron é decorativo e gira quando aberto. Enter e Espaço alternam a expansão,
com foco visível e sem controles interativos aninhados no summary.

Descrição e valor usam 15 px / 550. Conta e titular ficam juntos em 12 px, separados
por um traço vertical. Data e uma única etiqueta neutra de categoria ocupam a linha
seguinte; em containers a partir de 720 px, ocupam uma coluna central própria.
Estado confirmado fica nos detalhes; pendência e exclusão das análises
permanecem visíveis porque mudam a interpretação. Não colorir categorias ou
valores só para decorar. Padding vertical de 14–16 px, intervalos de 4 px dentro
do registro e 8–16 px entre colunas; altura cresce com conteúdo, sem recortes.

Dinheiro usa algarismos tabulares e formatação exata, preservando sinal e moeda.
Valores extensos podem quebrar sem perder dígitos; ausência é “Valor indisponível”,
nunca zero. Conta e titular podem quebrar juntos abaixo da descrição/valor em
containers até 420 px. IDs e origem ficam na expansão, com rótulos explícitos.
Hover usa superfície neutra; foco usa o token de destaque. Sem motion quando o
usuário prefere movimento reduzido.

Paginação em `.pagination`: recorte, próximo lote e retorno ao início. Nunca usar
a soma dos registros da página como total financeiro do período. Filtros continuam
no drawer. Validar descrição longa, contas e titulares diferentes, pendência,
ignorada, moeda alternativa, valor elevado e ausente na galeria viva.

### Listas operacionais e item compartilhado

Contas, regras, grupos e sincronizações usam `.record-list`, com cada `li` contendo
um `DisclosureItem className="record-item"`. Transações usam `.transaction-list`
e o mesmo componente com `className="transaction-item"`. Lista ordenada para
histórico de rodadas; listas comuns para os demais conjuntos. Não restaurar grids
de cards nem ocultar detalhes atrás de um ícone pequeno separado da linha.

`DisclosureItem` fornece `details`, `summary`, chevron de 16 px e classes
`.disclosure-item`, `.disclosure-summary`, `.disclosure-chevron`. O domínio passa
conteúdo a `summary` e `children`; a peça não conhece moeda, estado financeiro,
filtragem ou API. Não criar um `UniversalCard`, registry de campos ou dezenas de
flags para essa composição. Conservar classes separadas com espaços ao combinar
layout e estados, como `transaction-item wide-amount` ou `record-item wide-value`.

Resumo inteiro clicável, Enter/Espaço nativos e foco visível. O chevron é
`aria-hidden`, sem botão próprio; abrir gira o mesmo indicador. Hover e estado
aberto usam `--surface`, sem sombra ou animação de altura. Transição de 120 ms
apenas no fundo/chevron, removida com movimento reduzido. Links, botões, inputs e
outras ações ficam **fora do summary**, dentro do painel expandido; não criar
handlers que disputem com o comportamento nativo ou disclosures aninhados para IDs.

| Domínio | Sempre visível no resumo | Dentro da expansão |
| --- | --- | --- |
| Transações | Descrição, valor exato/moeda/sinal, conta e titular, data, categoria, entrada/saída; Pendente, Futura e Ignorada quando aplicáveis. | Parcelas conhecidas com data, valor e estado da origem; conta, titular, origem manual/importada e ID do lançamento. |
| Contas e cartões | Nome, titular, saldo/moeda, tipo, data observada e Dados parciais quando aplicável. Cartão mantém “não é dinheiro disponível”. | Perfil Pluggy, data/hora observada completa, ID da conta e link para suas transações. |
| Regras | Nome, Ativa/Pausada, condição e categoria, prioridade, movimento e restrição de conta. | Explicação completa da regra, campos de alcance, ID e link para lançamentos com a condição. |
| Grupos | Nome, tipo, moeda, orçamento ou desativado/valor não definido e início do mês. | Configuração do período/orçamento, ID e link para transações do grupo. |
| Sincronizações | Perfil, titular registrado, início e estado. Fase atual durante espera/execução; falha e registro recuperado quando aplicáveis. | Última etapa, etapas confirmadas, encerramento, erro completo, orientação de recuperação e IDs de rodada/conexão. |

Esses resumos são contratos de informação, não ordem fixa de colunas. Falha,
parcialidade, pendência, exclusão e natureza do saldo nunca exigem expansão para
serem percebidas. Não apresentar saldo ausente como zero, orçamento sem valor como
gratuito ou regra ativa como execução concluída. O resumo de sincronização mantém
o titular registrado no início; não reatribuir a rodada ao titular atual.

A composição comum usa `.record-title`, `.record-value`, `.record-context` e
`.record-meta`; detalhes em `.record-detail`. Nome e valor: 15 px / 550; contexto e
metadados: 12 px. Padding vertical de 14–16 px. É uma linha compacta que pode crescer
com descrição, nome ou alerta; não usar altura fixa nem truncar dinheiro. Valores
longos/ausentes de conta recebem `wide-value` e usam outra linha em espaço estreito.
O detalhe usa `dl` com labels, quebra de IDs e links com alvo mínimo de 44 px.

```tsx
<ul className="record-list" aria-label="Grupos">
  <li>
    <DisclosureItem
      className="record-item"
      summary={
        <>
          <span className="record-title">{group.name}</span>
          <span className="record-value">{groupTypeLabel}</span>
          <span className="record-context">{budgetLabel}</span>
          <span className="record-meta">
            {group.currency} · Mês começa no dia {group.monthStartDay}
          </span>
        </>
      }
    >
      <div className="record-detail">
        {/* Configuração e identificadores reais do domínio. */}
        <a href={transactionsHref}>Ver transações deste grupo</a>
      </div>
    </DisclosureItem>
  </li>
</ul>
```

O exemplo ilustra slots; labels e URL vêm do contrato da página. Categorias
continuam em linhas simples com tipo, limite e estado oculto. Etiquetas permanecem
uma lista curta de nomes: não adicionar interação sem conteúdo/ação real.

### Identidade bancária

`BankMark` renderiza um selo auxiliar de 28 × 28 px na galeria e 24 × 24 px no
título das linhas de contas; o SVG local tem 24 px e o fallback Phosphor, 20 px. O catálogo `bankMarks` contém Nubank, Itaú, Bradesco,
Banco do Brasil, Caixa, Santander, Inter e C6 Bank. Os assets derivados de
bancos-brasil têm revisão fixada no arquivo e [licença local](third-party/bancos-brasil-LICENSE.txt).
Não há consulta a CDN em runtime.

As contas atuais não expõem uma chave confiável de instituição no contrato, então
usam `<BankMark />` neutro. Passar `institution` apenas quando uma fonte autoritativa
fornecer a chave correspondente; não deduzir pelo nome livre da conta, pessoa ou
perfil Pluggy. A galeria demonstra marcas sem alegar conexões reais. O componente
é decorativo (`aria-hidden`): a identificação necessária permanece em texto.
Cores das marcas se limitam ao selo e não substituem a paleta semântica do produto.

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
`data.catalog` é o catálogo já validado na fronteira. `appliedSummary` vem do
recorte validado da URL e dos nomes do catálogo, como na função existente
`transactionFilterSummary`; não é construído a partir do rascunho aberto.

```tsx
<>
  <WorkspaceHeading
    description="Lançamentos por titular, conta e categoria, na moeda de origem."
    title="Transações"
  />
  <ResourceFeedback {...resource} />
  {!!data && (
    <>
      <FilterDrawer
        action="/account/transactions"
        summary={appliedSummary}
      >
        <ScopeFields catalog={data.catalog} params={params} snapshot={snapshot} />
        <label>
          Buscar descrição
          <input defaultValue={params.get("text") ?? ""} name="text" type="search" />
        </label>
      </FilterDrawer>
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
      <FilterDrawer
        action="/account/audit"
        summary={[params.get("days") === "1" ? "Período: 24 horas" : `Período: ${params.get("days") || "7"} dias`]}
      >
        <label>
          Período
          <select defaultValue={params.get("days") || "7"} name="days">
            <option value="1">24 horas</option>
            <option value="7">7 dias</option>
            <option value="30">30 dias</option>
          </select>
        </label>
      </FilterDrawer>
      {/* Concessões do contrato AuditReport. */}
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
   skip link funcional, foco visível e nenhuma armadilha. Abrir/fechar drawers e
   disclosures, aplicar/descartar rascunhos e confirmar/cancelar sem mouse. Foco não fica em conteúdo removido após revogação.
2. **Nome e alvo:** controles com label acessível, summary inteiro acionável sem links aninhados, ícones decorativos ocultos para
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
planos/baixos, tooltip elevado e profundidade ampla nos drawers. Todo movimento respeita `prefers-reduced-motion`.
Ver `DESIGN.md` e
[public-pages-qa.md](public-pages-qa.md) para jornadas e evidências.
