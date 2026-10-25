# Cartões e carteira do investidor

Branch `codex/cartoes-compromissos-design`, PR #13. Os commits dos PRs #9
(`c65a505`) e #10 (`29a87d3`) foram preservados sobre `27869b9`, incluindo as
correções de paginação de cartões e de transações movidas entre grupos.
O [plano da carteira](investor-area-plan.md) registra a correção de escopo.

## Produto

- **Investimentos** (`/account/investments`, `/demo/investments`) representa
  ativos financeiros importados/manuais. Posição bruta, líquida, resultado
  informado e resgate usam FinancialMetric; composição por classe e instituição
  usa AllocationChart e legenda exata. Detalhes mostram aplicação, impostos,
  taxas, quantidade e vencimento recebidos. Não há histórico/rentabilidade
  inferidos nem operação de aplicação/resgate.
- **Cartões** mantém gastos, limites, parcelas e paginação. A aba Compromissos
  e suas telas foram removidas; o contrato MCP `get_card_commitments` continua
  compatível. Investimentos usa posições de ativos, nunca parcelas de cartão.
- **MCP e painel** compartilham `get_investments`, contrato de saída, filtros e
  agregação. Moedas não são somadas; ausências invalidam o total e expõem subtotal
  conhecido. Resgatados e excluídos permanecem na lista, fora dos totais.
- **Identidade**: marcas de cartão em filtros/limites/transações, instituição em
  contas e investimentos, avatar de pessoa sobreposto. Crédito sem bandeira usa
  ícone genérico. Fonte do logo institucional: `connector.imageUrl` Pluggy;
  instituição explícita B3 prevalece sem atribuir um logo incorreto. Assets de
  bandeiras locais incluem licença Apache 2.0 e proveniência.
- **Comunicação**: explicações repetidas em títulos, métricas e filtros foram
  movidas para Tooltip Kumo. A demo mostra um único marcador. Falhas, ausências,
  parcialidade e consequências de ações continuam explícitas. A landing promove
  a carteira com link direto à demo.

## Fontes de implementação

A referência [Securo AccountIcon](https://github.com/securo-finance/securo/blob/43d48ffb49cecd538cf6ec67a7d059ac180e567e/frontend/src/components/account-icon.tsx)
usa logo de instituição com fallback; o backend obtém o logo do conector. Não foi
copiado código do Securo. Dados financeiros seguem
[Investment](https://docs.pluggy.ai/en/docs/products/investments) e
[List](https://docs.pluggy.ai/en/reference/investment/investments-list) da Pluggy.

## Evidência

As etapas de `mise run check` passaram: tipos, formatação, lint, 94 testes
unitários, 161 testes de integração, build/dry-run e runtime nativo com 10 mil
e 100 mil registros, incluindo persistência após reinício. O teste da rota
removida confirma 404; o contrato MCP de compromissos segue coberto.

Validação local com dados sintéticos. Inspeção no navegador inclui filtros por
pessoa/instituição, cartão Visa sem movimentos, carregamento de logos, temas
claro/escuro, detalhes por teclado e dimensões móveis. Os screenshots finais
estão em `docs/assets/financial-design/`.

Os testes cobrem importação persistida, perfis com IDs de origem iguais, valores
bruto/líquido distintos, prejuízo informado, resgate zero, quantidade decimal,
moedas, excluídos/resgatados, dados antigos sem metadados, dinheiro acima da
precisão de Number e contrato MCP. O teste OAuth local anuncia a ferramenta e
consulta uma posição manual com dinheiro exato através de `tools/call`.

A carteira usa o JSON existente, sem migração própria. Fotos de pessoas usam a
migração aditiva 0011, descrita abaixo. Reimportações
preservam grupo e inclusão. Novos campos de posições antigas serão preenchidos
quando a instituição os enviar na próxima sincronização.

Testes locais, dry-run e demo não comprovam deploy, banco remoto, conexão Pluggy,
OAuth de produção, leitor de tela ou host MCP externo. Nenhum desses fluxos foi
executado nesta entrega.

## Crítica aplicada à navegação e identidade

A captura `investments-before-polish.png` mostrou avatares com intervalo de 8 px,
filtros inline concorrendo com o diálogo, dois ícones semelhantes de recarga e
valores monetários quebrados em duas linhas. A referência fornecida pelo usuário
pediu círculos sobrepostos.

- `PersonStack`: até três círculos, sobreposição de 10 px e contador `+N`; o grupo
  integra o botão Filtros. Não há atalhos de pessoa concorrentes com o diálogo.
- `AccountAvatar`: pessoa + instituição/bandeira, dois círculos no mesmo eixo.
  Ao selecionar uma pessoa, as linhas mostram apenas a instituição/bandeira.
- Pessoa, grupo, cartão/classe, instituição e moeda ficam no diálogo. Busca e
  navegação temporal permanecem como ações diretas. Aplicar/Cancelar preservam
  a previsibilidade da consulta.
- Cada tela tem uma ação de atualização. Restaurar demonstração é uma ação
  textual distinta na navegação, sem ícone de recarga.
- Indicadores usam duas colunas no conteúdo intermediário e uma no celular;
  os números permanecem legíveis. Linhas de posições alinham com os cabeçalhos.

Evidência final: [carteira](assets/financial-design/investments-preview.png),
[combos nas posições](assets/financial-design/investments-identities-dark.png),
[celular em tema claro](assets/financial-design/investments-mobile-light.png) e
[filtro de cartões](assets/financial-design/cards-filters-dark.png).
A largura móvel efetivamente medida foi de 325 CSS px, sem overflow horizontal
ou quebra dos valores nos quatro indicadores. Aplicar pessoa/cartão e cancelar
seleção foram conferidos no navegador. Inspeção de teclado e reflow é local e
não constitui auditoria completa de acessibilidade.

## Fotos de pessoas

As duas fotos fornecidas para a demo aparecem no grupo do filtro, nas opções de
pessoa e nos combos com instituição/bandeira. Perfis reais aceitam upload em
Conexões, com prévia, troca e remoção; sem foto, mantêm as iniciais. O navegador
normaliza em JPEG de 160 × 160 px; o servidor aceita apenas imagens raster
embutidas de até 24.576 caracteres, com tipo e assinatura compatíveis. A foto
fica na coluna opcional `people.photo`, adicionada pela migração 0011. Atualizar
um nome sem enviar foto preserva a imagem existente; `photo: null` a remove.

O fluxo completo foi conferido em uma instalação isolada em localhost, com
credenciais sintéticas: upload, salvar, recarregar, remover, salvar, recarregar e
substituir a foto. A representação enviada de cada imagem ficou entre 8 e 9 KB. A demo foi
conferida em `http://localhost:8924/demo/investments/?currency=BRL`.

Captura do [editor de foto](assets/financial-design/person-photo-editor.png),
com upload e persistência verificados no navegador.
