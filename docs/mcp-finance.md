# MCP financeiro: catálogo e decisões

O [inventário gerado](mcp-tools.md) lista nomes, contagem, operações e schemas.
`npm run docs:mcp` o atualiza a partir do registro; `tools/list` é o contrato
executável. Campos desconhecidos, datas inválidas, valores não canônicos e
referências de outro espaço são recusados antes do commit.

A Pluggy fornece contas, transações, faturas, investimentos e empréstimos conforme
a instituição/conexão. Planejamento e edição são locais. As quatro ferramentas
`caderninho_*` preservam a visão da origem; as demais usam a visão efetiva, com
sobreposições e dados manuais. Administração de pessoas, perfis, credenciais,
conexões e autorizações permanece no painel.

## Pessoas e perfis Pluggy

A [titularidade](household.md) organiza múltiplos perfis e filtros por `personId`. `caderninho_status` fornece os IDs
das pessoas e perfis. Espaço, pessoa e aplicação são conceitos independentes.

## Contrato comum

Consultas aceitam `spaceId`, padrão `personal`. Toda escrita exige `spaceId`
explícito, `confirmed: true` e `idempotency_key` não vazia. Confirme com a pessoa
antes da chamada. A mesma chave e os mesmos argumentos normalizados devolvem o
resultado durável anterior. Reutilização para outra solicitação é recusada.
Nenhuma tool envia PIX, contrata crédito ou altera um registro na instituição.

Dinheiro entra e sai como string inteira de unidades mínimas da moeda.
Débito/crédito são magnitudes com direção separada. Moedas nunca são somadas entre
si. Valores desconhecidos permanecem `null`; subtotais conhecidos têm nomes
próprios. Contas manuais exigem uma moeda suportada explicitamente.

As consultas retornam `{data, partial, revision}` e metadados de escopo, visão e
qualidade. `get_transactions` retorna
até 500 registros, com cursor; qualquer alteração financeira concorrente exige
reiniciar. Escritas por seleção/período são atômicas e recusam mais de 500 registros.
Não há confirmação parcial de uma seleção maior. As escritas em D1 não refazem
coletas Pluggy nem alteram a admissão de uma importação a cada 24 horas.

## Decisões financeiras

- **Origem preservada:** exclusões de transações são tombstones locais. Reimportar
  não desfaz edições. Regras pessoais precedem defaults; defaults preservam categorias editadas localmente. Regras novas afetam novas transações; `apply_rules` reaplica
  explicitamente um período. Excluir regra não desfaz suas classificações.
  Regras ignoram caixa em A–Z; caracteres acentuados são literais. Importação e
  reaplicação seguem a mesma comparação e desempate por ID.
- **Classificação conservadora:** despesas/rendas requerem categoria local com
  tipo explícito. Movimentos ainda não classificados são contabilizados à parte;
  nomes de categorias de terceiros não viram regras implícitas de consumo.
- **Faturas:** marcação manual não altera valores/pagamentos bancários. A
  confirmação bancária usa a relação documentada entre faturas consecutivas,
  pagamentos e encargos na mesma moeda. Cartões manuais projetam faturas pelo
  fechamento/vencimento; `recurrenceId` em um lançamento substitui a ocorrência
  mensal correspondente para evitar duplicá-la na projeção.
- **Parcelamentos:** a Pluggy não fornece uma chave única de agrupamento. Cada
  parcela observada aparece como candidato independente, com `estimated: true`,
  sem afirmar pagamento das parcelas anteriores e sem gerar recorrências
  automáticas a partir de agrupamentos duvidosos. Planos manuais criam uma
  recorrência, não centenas de transações futuras.
- **Empréstimos/metas:** SAC distribui todos os centavos do principal, cobra juros
  mensais em pontos-base e arredonda juros half-up. Conciliações seguem a ordem;
  desfazer preserva a transação. Metas com ativo vinculado usam o saldo do ativo
  em lugar de somá-lo às contribuições. Valor contratado e saldo devedor da
  Pluggy permanecem distintos.

## Limites explícitos

Espaços organizam dados da instalação; não criam compartilhamento multiusuário
nem mudam uma seleção de espaço no painel. As preferências de notificação são
persistidas, mas não há serviço de envio: a resposta informa
`deliveryConfigured: false`. Fotografias de metas não são parte do modelo.

Gráficos retornam SVG seguro e séries exatas, separados por moeda. A geometria
usa proporções limitadas; os rótulos preservam inteiros completos. Há até 60 grupos
por gráfico. Roscas recusam valores negativos, que devem ser exibidos em barras.
O host MCP pode exigir uma ação adicional para exibir o SVG.

Projeções são estimativas de saldos BANK e compromissos conhecidos. Não presumem
rendimento, transações futuras desconhecidas ou faturas bancárias ainda ausentes.
Recorrências bancárias com lançamento confirmado no mês deixam de ser previstas;
ignorar um lançamento nas análises não o remove do saldo da conta manual.
Recorrências mensais limitam o horizonte a 1.200 meses. Metadados e configurações
são carregados por consulta; o histórico é percorrido em páginas, sem `SUM REAL`.
Essa abordagem favorece a instalação pessoal; desempenho e consumo em produção
não foram medidos nesta branch.

A integração real com Meu Pluggy, permissões por produto, OAuth em ChatGPT/Claude,
provisionamento e deploy continuam como validações externas. Os testes locais
usam apenas dados sintéticos e não constituem prova dessas etapas.

## Resultados, filtros e cobertura

Sucesso retorna `structuredContent` com o mesmo objeto canônico do bloco textual
JSON, preservado por compatibilidade. Essa serialização duplicada não economiza
contexto por si só. Sete consultas analíticas têm `outputSchema`: `get_card_commitments`, `get_overview`,
`get_spending_by_category`, `analyze_categories`, `get_spending_comparison`,
`get_spending_pace` e `generate_chart`.

Planejamento e lista agrupada expõem `view`, `scope`, `revision`, `coverage` e
`oldestLastSuccessAt`; `preview_rule` mantém seu envelope específico. Cobertura
considera pessoa, espaço, conta, transações movidas e conexões sem primeira coleta.
`coverage.kind` distingue importados, somente locais e ausência de fontes.
`partial: false` não promete dados recentes nem todo o histórico da instituição.

Resumo, série e detalhe aceitam filtros de conta, categoria, tag, moeda, cartão,
direção, status, texto e ignorados; os resumos devolvem a seleção aplicada.
Realizados ficam limitados a POSTED até o dia de referência, conforme `eligibility`.
Saldo, investimentos e empréstimos são contexto patrimonial separado desses totais.

Categorias devolvem ID, nome e rótulo. `amountMinor` é exato; `scale` e
`formattedAmount` permitem apresentação sem Number. Moeda desconhecida tem
`scale: null`. `knownUnclassifiedMinor` soma magnitudes conhecidas sem chamá-las de
despesa; `unclassifiedMinor` é null se houver valor desconhecido, com contagem própria.

`get_spending_comparison` informa as datas resolvidas e aceita `previous_period`
(intervalo anterior de mesma duração), `previous_month` (mesmos dias, limitados ao
fim do mês) ou `explicit`, que exige `previousFrom` e `previousTo` válidos.
`generate_chart` aceita `includeSvg: false` para devolver só séries; o padrão é
true. Para últimas compras, prefira `date_desc`, `limit: 5`, e reutilize grupos
presentes nos resumos. Não trunque descrições nem descarte grupos silenciosamente:
um registro extenso ou agrupamentos sem paginação podem produzir respostas grandes.

## Assinaturas e padrões de recorrência

`get_subscriptions` identifica candidatos no histórico efetivo; `get_recurrences`
continua listando compromissos cadastrados. A consulta não cria recorrências,
não confirma contratos e não informa se uma assinatura permanece ativa.

```json
{"name":"get_subscriptions","arguments":{"from":"2026-01-01","to":"2026-10-24","minOccurrences":3}}
```

Sem datas, analisa os últimos 12 meses até o dia de referência. Aceita `spaceId`,
`personId`, `accountId` e `currency`. Agrupa por conta, moeda, cartão e CNPJ do
estabelecimento; sem CNPJ completo, usa o nome do estabelecimento ou a descrição
normalizada. Não remove números da descrição nem deduplica cobranças por semelhança.
Exige três ocorrências por padrão (`minOccurrences`: 2–12), valores com variação
de até 20% sobre o menor valor e intervalos semanais, mensais, trimestrais ou anuais.
As tolerâncias são, respectivamente, 2, 3, 7 e 14 dias; meses respeitam o calendário.
Para padrões anuais, amplie o período e/ou use `minOccurrences: 2`.

Exclui ignorados, excluídos locais, créditos, pendentes, futuros, transferências
classificadas, pagamentos de fatura e parcelas identificadas. Valores desconhecidos
ou zero não sustentam candidatos. Repetições no mesmo dia, intervalos irregulares
e grandes mudanças de valor podem impedir a detecção. Débitos sem classificação
podem sustentar um candidato a cobrança recorrente, sem se tornarem despesas
confirmadas. O nome de um serviço sozinho não comprova recorrência.

Cada candidato informa frequência, primeira/última ocorrência, quantidade,
valores mínimo/máximo/mais recente, soma observada exata e as últimas três
evidências com IDs, datas e valores. `nextExpectedDate` é uma estimativa e pode
estar no passado. Não some projeções a valores realizados.

A leitura para em 10 mil registros efetivos e devolve `scannedCount`/`scanLimit`.
`limit` limita candidatos (padrão 50, máximo 100). `truncated` sinaliza qualquer
um desses cortes; nesse caso, `matchedCount` descreve apenas o que foi encontrado
na análise, não o universo completo. Reduza o período ou selecione uma conta.
`estimated`, `partial`, cobertura e referência da última coleta acompanham a
resposta: ausência de candidatos não comprova ausência de assinaturas.

## Correspondência com o painel

| Capacidade | Contrato compartilhado |
| --- | --- |
| Catálogo e categorias | `get_categories` com `include_hidden: true` reconstrói o catálogo, incluindo aparência e vínculos; nomes fixos são protegidos. |
| Resumo e série mensal | `get_overview` e `generate_chart` agregam o período completo por moeda. |
| Cartões e parcelamentos | `get_card_commitments` mantém a consulta de compromissos de cartão: gastos efetivos, parcelas observadas por mês, limites informados e categorias, com moedas separadas. Veja [a política de cálculo](card-commitments.md). |
| Ocorrências e compras | `get_transactions` lista registros; `get_transaction_purchases` usa o serviço do painel e agrupa antes de paginar. O valor é de uma parcela, não da compra inteira. |
| Prévia e regras | `preview_rule` compartilha validadores/serviço com o painel: até 10 mil registros, cinco amostras, `partial` e `truncated`. Não escreve nem prevê a regra vencedora; `apply_rules` é explícito e atômico até 500 registros. |
| Escritas locais | Categorias, agrupadores, regras e espaços usam os mesmos serviços. Excluir agrupador preserva categorias; excluir espaço exige ausência de vínculos e protege o pessoal. |

O painel usa sessão/origem/CSRF; MCP usa OAuth. O alias interno
`get_portal_transactions` e os endpoints existentes conservam seus contratos.
A [importação de regras JSON](rule-packs.md) oferece prévia sem escrita e commit
atômico com revisão/idempotência, preservando o histórico.

## Consultas e custo

Período e contas são aplicados no SQL usando os índices existentes. Origens com
sobreposições são buscadas por ID e avaliadas após edições de data, conta, espaço,
classificação ou exclusão. Filtros residuais de categoria, tag e texto, edições e
lançamentos manuais podem exigir trabalho em memória proporcional ao volume.

Saldos importados dispensam transações quando não há contas manuais selecionadas;
só essas contas são lidas para calcular saldos manuais. Ocorrências usam cursor
no banco e encerram a leitura ao obter `limit + 1` correspondências, combinadas
com edições/manuais. A lista de compras conserva a travessia necessária para agrupar
parcelas completas antes da paginação.

Comparar períodos faz uma passagem no intervalo que engloba ambos; intervalos
explícitos distantes também podem ler os registros entre eles. Tags, regras,
categorias, grupos, espaços e preferências leem o catálogo/contexto mínimo;
outras famílias ainda usam o snapshot completo. Não há cache global financeiro
nem materialização persistida adicional. Meça `meta.rows_read` e custo real antes
de prometer consumo ou latência constantes.

## Validação

`tests/integration/front-mcp.test.ts` compara compras, prévia e escritas do painel
com chamadas MCP HTTP/OAuth sintéticas. `mcp.test.ts` cobre catálogo e transporte;
`planning-feedback.test.ts` cobre filtros consistentes, cobertura, moedas, precisão,
comparações, paginação editada e seis schemas de saída. Cenários com 1.000 e 10.000
registros fora do período verificam leitura/materialização limitada para o recorte.
`subscriptions.test.ts` cobre evidências, filtros, exclusões, limites e a chamada
MCP/OAuth sintética de `get_subscriptions`, incluindo o schema de saída.

A medição D1 reexecuta os SELECTs reais na mesma fixture para obter `rows_read`,
porque Drizzle `raw()` descarta metadados. Ela não inclui leituras do snapshot nem
representa orçamento universal, p95 ou custo de produção. Os testes de instalação
e o harness nativo cobrem replay, falhas parciais e persistência após reinício.
`mise run check` executa a validação local com dados sintéticos.

Pluggy real, provisionamento, deploy, OAuth no host e renderização de SVG/MCP Apps
exigem validação separada. Skill instalada e endpoint ativo não demonstram uma
chamada autenticada no host; o catálogo de ferramentas depende da conexão dele.

A carteira de ativos do painel e da demo compartilha `get_investments`; consulte
[valores, identidade e limites da carteira](investments.md).
