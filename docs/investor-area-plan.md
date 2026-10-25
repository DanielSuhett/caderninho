# Carteira do investidor

## Objetivo

Investimentos representa ativos importados de `GET /investments` da Pluggy e
posições manuais. Parcelas continuam em Cartões; a aba Compromissos foi removida.
Implementação na branch `codex/cartoes-compromissos-design`, sem deploy.

## Entrega

1. Ampliar a normalização e o JSON já persistido com valores bruto, líquido,
   aplicado, resultado informado, disponível para resgate, impostos, tipo,
   subtipo, status, datas, taxas e instituição. Preservar paginação, identidade da
   origem e escolhas humanas de grupo/inclusão no reimportar.
2. Ampliar `get_investments`, usado pelo painel e MCP, com filtros de pessoa,
   grupo, moeda, classe e instituição. Retornar totais exatos por moeda e
   alocações por classe/instituição; ausência não equivale a zero. Manter campos
   públicos existentes e acrescentar metadados opcionais para dados antigos.
3. Publicar a tela Investimentos em `/account/investments` e a demo equivalente.
   Métricas, donuts, legendas e posições compartilham o padrão visual de Cartões.
   Remover a aba e as telas de Compromissos, preservando seu contrato MCP.
   Usar instituição + avatar da pessoa, filtros claros e detalhes sob demanda.
4. Promover a carteira na landing com acesso direto à demo. Validar importação,
   MCP, cálculos, filtros, ausência de dados, moedas, exclusões e responsividade.

## Semântica

`amount` é bruto; `balance` é líquido; `amountProfit` é resultado líquido
acumulado informado; `amountWithdrawal` é resgate disponível. Não calcular
rentabilidade a partir da diferença de posições. Não somar moedas. Não inventar
histórico: os gráficos exibem composição atual. Excluídos e totalmente resgatados
continuam consultáveis, mas não compõem totais. Valores desconhecidos deixam o
total indisponível e expõem subtotal conhecido/contagem. Imagens da instituição
vêm do connector Pluggy com fallback; a instituição B3 explícita prevalece sobre
a marca da conexão e nunca recebe o logo de outra instituição.

Fontes: https://docs.pluggy.ai/en/reference/investment/investments-list e
https://docs.pluggy.ai/en/docs/products/investments (consultadas em 25/10/2026).

## Limites de validação

Fixtures, importação e MCP locais não comprovam conexão bancária, OAuth real,
dados de produção ou suporte de cada instituição. Não há migração SQL: os
metadados usam o JSON existente. Nenhuma ordem financeira é executada.
