# Pessoas e múltiplos perfis Pluggy

Uma instalação continua tendo um administrador e um conjunto de autorizações MCP.
Agora ela pode reunir fontes de várias pessoas. Identificação de titularidade não
é controle de acesso: painel e assistentes autorizados enxergam toda a instalação.

## Organizar no dashboard

1. Em **Conexões**, use **Adicionar conexão**. Escolha o titular ou adicione outra
   pessoa no próprio wizard, independentemente do filtro herdado na página.
2. Escolha uma conta Pluggy já cadastrada para esse titular ou informe o nome,
   Client ID e Client Secret de outra aplicação. O servidor valida antes de salvar;
   uma nova pessoa e seu perfil são confirmados no mesmo batch D1.
3. Use **Abrir Meu Pluggy**. Cada pessoa autoriza suas instituições no fluxo do
   provedor. O perfil validado permanece disponível se a janela for fechada.
4. Use **Importar esta visão**. Os botões de pessoas filtram contas e conexões;
   “Todos” reúne os titulares sem somar moedas ou tratar limite/cartão como saldo.
5. Para corrigir um titular, expanda **Alterar titular** na conexão. Todo o histórico
   e os produtos daquela conexão acompanham a atribuição, sem reimportar ou mudar
   credenciais. Não é alteração do titular no banco.

Cada perfil pode ser renomeado, pausado ou ter seu segredo atualizado. Pausar
impede novas admissões; uma execução em curso pode parar na próxima leitura,
preservando páginas já publicadas. Reativar respeita a janela original de 24h.
Para trocar a aplicação (Client ID), crie outro perfil: a identidade de um perfil
que já recebeu credenciais não pode ser alterada. Não há exclusão de histórico,
pessoas ou perfis nesta interface.

Falhas de validação aparecem junto ao formulário, com foco no aviso e orientação
específica para credenciais recusadas, aplicação já cadastrada ou indisponibilidade.
Os campos permanecem preenchidos quando o cadastro é rejeitado. Uma falha ao
atualizar a lista depois de salvar é informada como cadastro salvo; não solicita
que o usuário recrie a pessoa ou o perfil.

No frontend, `use-connection-wizard.ts` controla etapas, validação e envio;
`connection-wizard-view.tsx` contém somente a apresentação. A edição de perfis
usa `use-household-editor.ts`, separada do layout em `household-view.tsx`.

## O limite do provedor

O limite local antigo de dez conexões foi removido. Seleções explícitas de sync e
consultas aceitam até 200 IDs por chamada. Isto não altera o limite da Pluggy.
O [Meu Pluggy pessoal](https://docs.pluggy.ai/pt/docs/guides/meu-pluggy-personal-use)
e a [página de preços](https://www.pluggy.ai/precos) descrevem até cinco conexões
ativas por titular no uso gratuito. Mais de cinco conexões na visão conjunta pode
vir de titulares distintos ou de uma oferta autorizada pelo provedor; cadastrar
novas credenciais não garante ampliar a cota individual.

A mesma conta conectada em duas aplicações gera duas origens distintas. Não há
deduplicação presumida por nome, saldo ou IDs de aplicações diferentes. Evite
conectar a mesma conta duas vezes quando quiser analisar totais consolidados.

## Modelo e identidade

| Conceito | Persistência | Significado |
| --- | --- | --- |
| Pessoa | `people` | Nome de exibição; não exige CPF nem credenciais bancárias. |
| Perfil Pluggy | `pluggy_profiles` | Aplicação, titular padrão, nome, pausa e referência privada de credenciais. |
| Titular da conexão | `connection_owners` | Liga o histórico a uma pessoa e a um perfil; atribuição da pessoa é editável. |
| Espaço | `planning_spaces` | Organização do planejamento; independente da pessoa e do perfil. |
| Conta manual | `planning_accounts.data.personId` | Titular escolhido explicitamente; ausência histórica significa `self`. |

Contas, transações, faturas e cartões herdam a pessoa da conexão. Investimentos e
empréstimos importados resolvem sua conexão no momento da consulta. Recursos
manuais (contas, investimentos, empréstimos e metas) aceitam `personId`; omitir
na criação mantém `self`. As consultas novas devolvem identificação do titular
nos registros financeiros principais e aceitam filtro opcional `personId`.
Categorias, regras, orçamento e preferências continuam organizados por espaço;
um filtro de pessoa recorta o uso financeiro, não redefine os limites do espaço.

As quatro ferramentas originais continuam disponíveis. `caderninho_status` inclui
pessoas, perfis sem segredos e titular de cada conexão. `caderninho_transactions`
e `caderninho_aggregate` aceitam `filter.personId` e `filter.profileId`. As novas
queries, como `get_accounts`, `get_transactions`, `get_overview`, `get_bills`,
`get_investments` e `get_loans`, aceitam `personId` na raiz. Exemplo:

```json
{"spaceId":"personal","personId":"ID_RETORNADO_NO_STATUS"}
```

O perfil legado `default` mantém IDs antigos, compatíveis com histórico, cursores,
edições, metas e checkpoints existentes. Novos perfis usam
`pluggy:<profileId>:<idCodificado>` em conexões, contas, transações, investimentos,
empréstimos e faturas. Apenas o adapter traduz para IDs brutos da API. Ele valida
Item/conta de origem antes de aplicar o prefixo. Nunca tenta outra credencial
quando um perfil falha ou está pausado.

A migração aditiva `0003_household.sql` cria três tabelas, remove somente o trigger
de limite local e atribui conexões existentes a `default`/`self`. As dezoito colunas
originais de `connections`/`transactions` e seus IDs são preservados. Alterações de
titular invalidam cursores de consultas para impedir paginação misturada.

## Credenciais e operação

Os secrets `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` continuam sendo a configuração
inicial do perfil `default`. A primeira utilização vincula sua aplicação por hash;
um Client ID diferente é recusado para impedir que o histórico legado mude de
origem silenciosamente. Em uma atualização de instalação, preserve o par atual.

Credenciais cadastradas pelo painel ficam somente no KV do servidor, sob o prefixo
`pluggy-credentials:`, separado das chaves OAuth. D1 guarda referência aleatória e
hash do Client ID. GET do painel, status MCP e logs não devolvem o segredo nem a
referência. Formulários exigem sessão, origem e CSRF; o segredo não fica em estado
React nem em armazenamento do navegador. Campos de credenciais são limpos
depois de um salvamento confirmado, preservados no DOM quando houver rejeição.

O [KV é criptografado em repouso e em trânsito pela Cloudflare](https://developers.cloudflare.com/kv/reference/data-security/).
Não há criptografia adicional com chave própria da aplicação. Quem administra o
Worker/KV tem acesso administrativo às credenciais. Uma versão nova é escrita antes
de atualizar a referência D1. Versões anteriores permanecem no KV; falha de escrita
D1 pode deixar uma versão sem referência. A leitura de uma versão ainda indisponível
falha sem fallback, permitindo retentativa do Workflow. A senha do painel pode ser
rotacionada sem perder os perfis. Backup completo inclui D1, KV e secrets do Worker.

## Validação

Os testes usam somente dados fictícios. Cobrem migração de histórico existente,
mais de dez conexões locais, isolamento entre aplicações com IDs iguais, escolha
de credenciais, rotação sem troca de aplicação, pausa, filtros, titularidade manual,
reatribuição e proteção das rotas administrativas. Validação no navegador usa uma
instalação Wrangler local separada. Isto não comprova consentimento real de duas
pessoas, disponibilidade de produtos por plano ou ampliação de limites do provedor.
