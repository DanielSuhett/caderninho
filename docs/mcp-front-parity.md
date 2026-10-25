# Paridade financeira entre painel e MCP

Conferência local de 24/10/2026, antes do merge das mudanças de temas, categorias
e identificação financeira. Escopo confirmado pelo dono: dados financeiros,
regras, categorias e grupos. Administração de pessoas, perfis Pluggy,
credenciais, conexões e acessos de assistentes continua no painel.

## Correspondência de capacidades

| Uso no painel | Ferramentas MCP | Contrato preservado |
| --- | --- | --- |
| Catálogo, contas e seleção de grupos | `get_accounts`, `get_spaces`, `get_categories`, `get_category_groups`, `get_rules`, `get_tags` | IDs, visibilidade, ícones, cores e vínculos. Para reconstruir o catálogo do painel, consultar categorias com `include_hidden: true`. `caderninho_status` informa pessoas e perfis disponíveis sem administrá-los. |
| Visão geral e despesas mensais | `get_overview`, `generate_chart` com `groupBy: "month"` e `type: "line"` | Período, moeda, escopo e totais do histórico completo; transferências e ignorados não viram despesas. |
| Transações e compras parceladas | `get_transactions`, `get_transaction_purchases` | A primeira lista ocorrências individuais; a segunda compartilha o serviço da lista do painel, agrupando antes da paginação. Preserva identificação, pendências e parcelas futuras conhecidas. |
| Prévia, cadastro e reaplicação de regras | `preview_rule`, `create_rule`, `update_rule`, `delete_rule`, `apply_rules` | Prévia sem escrita, condições E/OU, escopo obrigatório e comparadores exatos. Salvar não altera o histórico; reaplicar exige período e confirmação explícitos. |
| Edição de categorias, agrupadores e grupos financeiros | `create_category`, `update_category`, `delete_category`; `create_category_group`, `update_category_group`, `delete_category_group`; `create_space`, `update_space`, `delete_space` | Mesmos comandos do painel, confirmação e idempotência. Nomes das categorias fixas são protegidos; apagar agrupador preserva categorias. Espaços têm proteção contra remoção com referências ativas. |

O [inventário gerado](mcp-tools.md) contém a contagem atual e distingue
consultas, escritas locais e sincronização. A revisão dos registros e despachos não encontrou
ferramentas de planejamento sem implementação. Contar registros não comprova
a execução de todos os caminhos possíveis de cada ferramenta.

## Lacunas corrigidas

`preview_rule` e `get_transaction_purchases` existiam como capacidades do painel,
mas não eram ferramentas MCP. Antes da correção, as chamadas de integração
retornavam `UNKNOWN_TOOL`. Agora usam os mesmos validadores e serviços do painel;
o alias interno `get_portal_transactions` e os endpoints existentes foram preservados.
O CSRF continua obrigatório no transporte do painel; o MCP usa autorização OAuth.

A rodada de criação e edição também encontrou duas categorias ocultas legadas
de novos espaços sem `color`, `icon` e `groupId` na resposta MCP. A criação agora
preenche os mesmos padrões do catálogo. A migração aditiva `0009_fixed_categories.sql`
já normaliza os registros existentes; essa correção não exige outra migração.

## Dados e limites

Valores monetários permanecem strings inteiras em unidades mínimas. O teste de
prévia usa valores acima do limite inteiro seguro do JavaScript e verifica o
limiar exato, sem misturar BRL com USD. As parcelas mantêm seus próprios valores;
somar uma página de compras não produz o total do período nem o valor original
de uma compra. Para agregações, usar `get_overview` ou as consultas financeiras.

A prévia examina até 10 mil registros e retorna até cinco amostras; `partial` e
`truncated` devem acompanhar a interpretação da contagem. Paginação e prévia
recusam revisão concorrente com `RESTART_REQUIRED`. Reaplicação e edições em lote
preservam o limite atômico de 500 registros e nunca alteram os registros bancários
de origem. Todas as escritas de planejamento exigem `confirmed: true` e
`idempotency_key`.

## Evidência reproduzível

`tests/integration/front-mcp.test.ts` executa chamadas HTTP reais no Worker local,
com autorização OAuth sintética, SDK MCP nativo e D1 com migrações. Os três cenários
comparam prévia e compras com o painel e exercitam as 12 escritas de categorias,
agrupadores, regras e espaços. Verificam também repetição idempotente, conflito de
chave, confirmação ausente, isolamento entre espaços, reaplicação explícita e
preservação do dado de origem. `tests/integration/mcp.test.ts` mantém a cobertura
do catálogo, das ferramentas originais e dos erros do transporte.

```sh
mise exec -- npx vitest run tests/integration/front-mcp.test.ts tests/integration/mcp.test.ts
mise run check
```

Resultado desta conferência: os oito testes direcionados dos dois arquivos
passaram. `mise run check` passou com 68 testes Node, 121 testes de integração
em 22 arquivos, lint, tipos, formatação, build/dry-run e runtime Workflow/D1
com 10 mil e 100 mil registros sintéticos, replay, falhas parciais e persistência.
Os avisos opcionais conhecidos do Kumo continuam no log; não impediram o gate.

Os dados são sintéticos. Esta evidência não comprova OAuth em um host ChatGPT ou
Claude, cobertura real de instituições Pluggy, inferência Clef em produção,
deploy ou migração remota. Essas etapas não foram executadas nesta conferência.
