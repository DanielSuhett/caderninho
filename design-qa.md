# Revisão do workspace Caderninho

final result: passed

## Referência e escopo

Aplicação existente na base `f1051f9`, contrato visual `DESIGN.md` e captura
`work/household-preview/design-reference.jpg`. O pedido é expandir as páginas
mantendo a identidade, não reproduzir o layout antigo integralmente. A mudança
intencional é separar leitura e configuração, com navegação persistente.
A revisão seguiu o Product Design, com comparação conjunta das imagens de
referência e implementação. Não foram necessárias imagens geradas ou novas fontes.

Todas as imagens e os dados da prévia são locais e sintéticos. Capturas ficam em
`work/household-preview/`, ignorado pelo Git; não contêm dados reais de clientes.
A referência foi capturada no painel de largura natural; as novas telas foram
comparadas tanto por identidade quanto por funcionamento em larguras distintas.
Não se trata de uma medição de diferença de pixels entre layouts idênticos.
A captura de entrega é `transactions-desktop-final.jpg`, conferida em 1280 × 900
(largura do documento 1265 px, sem transbordamento).

## Superfícies de fidelidade

| Superfície | Evidência e avaliação |
| --- | --- |
| Fontes | Hanken local confirmado por estilo computado; wordmark preservado, títulos com hierarquia menor para acomodar navegação; números tabulares e valores exatos. |
| Espaçamento | Sidebar e conteúdo separados, formulários agrupados em superfície existente, listas com divisores; filtros avançados recolhidos para aproximar a lista do topo. |
| Cores | Tokens originais preto, cinza e laranja; estado ativo inclui borda e `aria-current`; sucesso/falha incluem texto, além de cor. |
| Imagens e ícones | Sem imagens decorativas, avatares ou ícones novos. Wordmark tipográfico e indicador nativo de disclosure mantidos. Não há substituição de imagem por CSS/SVG. |
| Layout e responsividade | Tabela no desktop, registros com rótulos no celular; navegação vira grade de três colunas; largura intermediária também inspecionada. |

## Passes de comparação

1. Referência versus primeira lista de transações: P2 de densidade. Os filtros
   ocupavam quase toda a primeira tela. Correção: disclosure “Mais filtros”,
   aberto automaticamente quando há filtro avançado ativo. Evidência anterior:
   `workspace-before-filters.jpg`.
2. Referência versus `overview-desktop.jpg`, `rules-desktop.jpg`,
   `groups-desktop.jpg` e `sync-desktop.jpg`, visualizados juntos: marca, paleta,
   fonte e superfícies preservadas. O novo espaço lateral é intencional.
3. Celular: `transactions-mobile-details.jpg` confirma descrição, titular,
   categoria e valor legíveis sem tabela horizontal. `rules-mobile.jpg`,
   `groups-mobile.jpg` e `sync-mobile.jpg` revelaram seletores estreitos; correção:
   campos em uma coluna até 480 px.
4. `sync-mobile-final.jpg`: seletores com 308 px de largura, texto completo e
   nenhuma rolagem horizontal. Não restam achados P0, P1 ou P2 nesta revisão.

## Viewports e comportamento

Dimensões CSS efetivas, conferidas no DOM (a prévia tem escala de interface):
1067 × 750, 800 × 900 e 390 × 844. A largura de rolagem foi, respectivamente,
1054, 787 e 377 px; não houve rolagem horizontal do documento. A prévia não foi
validada em Safari ou em um aparelho físico.

Fluxos exercitados no navegador:

- Login, navegação entre as seis páginas, seção ativa e manutenção da seleção.
- Transações de Ana + Mercado: seis resultados; busca sem resultado: estado vazio;
  grupo Casa em comum: lançamentos do titular correspondente.
- Paginação de transações: 50 + 17 registros no grupo Pessoal sintético; filtro
  inválido exibe recuperação e “Limpar todos os filtros” restaura 50 registros.
- Regras pausadas: apenas Delivery; link de condição abre lançamentos equivalentes.
  Grupo Casa em comum mostra sua categoria própria e orçamento.
- Histórico: 25 + 5 rodadas; filtro Falhou retorna cinco; atualizar preserva o
  recorte. Conexões mantém controles de perfil, reautorização e titularidade.

Console consultado ao final desses fluxos: sem erros ou avisos capturados.
Durante rebuilds locais, a sessão antiga expirou e o login foi repetido; isso não
é tratado como evidência de OAuth real. Foco, disclosures, botões, labels e
cabeçalhos usam controles semânticos. O salto foi exercitado por Tab e Enter: foco visível e destino
`workspace-content`. “Mais filtros” foi aberto, o filtro Entradas foi aplicado e
permaneceu aberto após a navegação, mostrando apenas entradas. A geometria final
mobile manteve o documento sem rolagem horizontal.

## Verificação automatizada e limites

A suíte inclui 19 testes Node, 70 testes de integração Cloudflare, tipos, lint,
formatação, build Vite, dry-run Wrangler e runtime nativo com 10 mil/100 mil
lançamentos. A execução final de `mise run check` terminou com código 0; log local
em `work/household-preview/frontend-check.log`. Os cinco testes novos cobrem histórico, migração, atomicidade,
titularidade, sessão/CSRF e paginação monetária exata.

Regras/grupos são visualização; edição e aplicação permanecem no MCP. Histórico
pré-migração só recupera a última rodada de cada conexão. A importação de 100 mil
registros não mede a latência da página de transações para esse volume.
Não houve push, deploy, migração remota, acesso Pluggy real ou validação OAuth/MCP
em host externo nesta revisão.
