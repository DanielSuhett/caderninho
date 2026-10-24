# Páginas da instalação

O painel mantém a identidade do Caderninho: Hanken local, fundo preto, superfícies
escuras, laranja para ação e foco. A navegação permanece disponível em todas as
páginas: barra de 208 px no desktop e menu de 44 px junto ao título no
compacto, com destinos nomeados em “Abrir navegação”.

| Página | Conteúdo |
| --- | --- |
| `/account` | Visão geral de contas, saldos e titulares |
| `/account/transactions` | Lançamentos, filtros, detalhes e paginação |
| `/account/rules` | Condições, categoria de destino, prioridade e estado das regras |
| `/account/groups` | Espaços de planejamento, orçamento, categorias e tags |
| `/account/sync` | Rodadas admitidas, etapas, conclusão e falhas |
| `/account/audit` | Autorizações OAuth, uso por cliente/modelo declarado, bytes e falhas |
| `/account/design-system` | Referência viva de componentes e layouts, com exemplos fictícios |
| `/account/connections` | Pessoas, aplicações Pluggy, conexões e acesso do assistente |

## Pessoa, perfil e grupo

**Pessoa** identifica o titular declarado. **Perfil Pluggy** identifica a aplicação
que autoriza a coleta. **Grupo** é o espaço de planejamento já utilizado pelas
ferramentas MCP: pessoal, família ou profissional. Grupo não muda titularidade,
não cria uma permissão e não divide o consentimento bancário.

A instalação continua privada para seu dono, com acesso a todas as pessoas.
Os filtros são recortes de consulta. Os links preservam pessoa e grupo quando
aplicável; o histórico informa que uma sincronização abrange a conexão inteira.

## Consultas e regras

Transações aparecem da data mais recente para a mais antiga, com ID como desempate,
em páginas de até 50 registros. Os valores mantêm moeda e unidades mínimas exatas;
não há soma enganosa apenas da página nem conversão cambial implícita. Campos
ficam no drawer “Filtros”; uma linha mantém o contexto de grupo/pessoa ou período
junto aos resultados e o gatilho conta filtros adicionais. Os campos no drawer
mostram cada critério aplicado.
Futuros e limpar ficam no drawer. Categoria e identificadores ficam na expansão
de cada lançamento; valor, sentido, moeda e exceções seguem visíveis.
Editar é rascunho: Aplicar submete GET e reinicia a paginação;
Cancelar, X e Escape descartam. Limpar filtros remove também grupo e pessoa.
Filtros e cursor ficam na URL, permitindo recarregar, voltar e guardar o recorte.

O Worker reutiliza a visão financeira efetiva das ferramentas MCP, incluindo
lançamentos manuais, alterações e ignorados. O novo argumento opcional
`order: "date_desc"` de `get_transactions` habilita a ordenação por data; o padrão
`id` preserva o contrato anterior. Cursores vinculam filtros, ordem e revisão; uma
mudança de dados pede reabertura da lista. A consulta ainda percorre o histórico
para construir a visão efetiva; a latência visual com 100 mil lançamentos não foi
medida nesta entrega.

Regras têm criação e edição em drawer; grupos usam um diálogo curto adaptativo.
Regras ativas classificam as
próximas importações; salvar não reclassifica o histórico. Ver lançamentos que
atendem à condição é somente consulta. A página Grupos lista todos os grupos;
o seletor recorta apenas as categorias e etiquetas, que ficam recolhidas.

## Hierarquia de leitura

A visão geral coloca contas e saldos antes do resumo recolhido da instalação.
Conexões mantém a jornada, o progresso real e os caminhos de recuperação; seus
metadados ficam em detalhes. A auditoria começa pelos assistentes autorizados e
mostra falhas antes da atividade técnica recolhida. Sincronizações mantêm estado,
titular e “Início”; referências históricas ficam ao fim. A galeria abre por assunto.
As listas compartilham uma superfície delimitada, sem um card por registro.
Resumo e detalhe usam o mesmo recuo de 16 px; dados vêm antes do rodapé de ações.
Os controles têm 36 px no desktop e 44 px no compacto ou toque. Editar/Excluir
ficam discretos, com nomes acessíveis contextuais e confirmação de exclusão.
IDs raros ficam em uma única “Referência técnica”; condições, escopos, erros e
parcialidade permanecem no conteúdo que explicam. Moeda e orçamento do grupo
aparecem uma vez no resumo. O grupo base Pessoal não oferece exclusão.

O editor de grupo ocupa até 560 px; uma confirmação curta, 440 px. A altura segue
o conteúdo, limitada a 90dvh, com corpo rolável e ações acessíveis. No celular,
diálogos curtos ficam na base com margem de 16 px. Regras longas conservam o
drawer de 720 px. Cancelar uma confirmação recebe foco; Escape devolve o foco ao
gatilho. Descartar só elimina o rascunho, nunca os dados persistidos.

## Histórico persistente

`0004_sync_history.sql` acrescenta uma tabela e um trigger. Cada admissão cria uma
linha; cada checkpoint atualiza a mesma rodada, na mesma operação D1 que confirma
seu progresso. Repetir um checkpoint não duplica o histórico. A pessoa e o perfil
ficam vinculados à rodada desde a admissão; corrigir titularidade depois não
reescreve essas referências. Nomes são resolvidos pelo cadastro atual.

A migração recupera apenas a última rodada que ainda está em `connections` e a
marca como anterior à versão. Rodadas sobrescritas antes da migração não podem ser
reconstruídas. Falhas antigas sem horário final ficam com fim “Não registrado”.
O contador mostra **etapas confirmadas**, nunca quantidade de transações. A lista
usa páginas de 25 rodadas, ordem de admissão decrescente, filtros de pessoa/estado
e atualização explícita. Consultar a página não inicia sincronização.

## Segurança e validação

Todas as páginas exigem sessão. Catálogo e histórico são leituras autenticadas;
a consulta financeira usa POST com origem, JSON e CSRF validados, permitindo
somente `get_accounts` e `get_transactions`. Nenhuma credencial é devolvida.

`tests/integration/workspace.test.ts` cobre histórico, replay, falha, migração,
titularidade, autenticação, CSRF, bloqueio de mutações e paginação cronológica
com valores acima do limite inteiro seguro de JavaScript. A revisão de navegador
usa apenas dados fictícios locais; evidências da navegação e filtros ficam em [navigation-review.md](navigation-review.md).
Publicação, migração remota e validação com Pluggy/OAuth reais não foram executadas.

O [guia de componentes](design-system.md) define a composição das páginas. Cabeçalhos, filtros, métricas, atualização e skeleton são compartilhados. A [auditoria](mcp-audit.md) explica identidade, volume, retenção e limites.
