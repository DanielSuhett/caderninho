# Pessoas e bancos

Uma instalação tem um administrador e um conjunto de autorizações MCP.
Ela reúne fontes de várias pessoas. Identificação de titularidade não
é controle de acesso: painel e assistentes autorizados enxergam toda a instalação.

## Organizar em Pessoas

1. No primeiro acesso a `/account`, salve nome e foto opcional. Depois informe
   Client ID e Client Secret na própria instalação. A validação precede o cofre;
   campos recusados permanecem no formulário e o segredo é limpo ao salvar.
2. Em **Pessoas** (`/account/connections`), + autoriza um banco pelo Meu Pluggy.
   Os próximos bancos reutilizam o acesso da pessoa, com autorização própria.
   Outra pessoa começa por nome/foto e usa o próprio acesso Meu Pluggy.
3. A seta **Concluir pessoas e importar** inicia os bancos ainda não admitidos,
   de todas as pessoas. O cron também aguarda a primeira admissão explícita;
   leituras nunca iniciam importação. O loading usa estado e fases reais e abre
   Consultar ao concluir. Recarregar mantém os pedidos existentes.
4. Em **Consultar**, copie a URL MCP para ChatGPT ou Claude e autorize via OAuth.
   Mostrar instruções ou copiar a URL não confirma que um assistente foi conectado.
5. Caneta edita nome/foto; relógio abre o histórico filtrado daquela conexão.
   Ajustes reúne pausa/credenciais existentes, reautorização, correção de titular
   e revogação de assistentes. Esses dados e perfis anteriores são preservados.

A jornada oferece um acesso principal por pessoa, com vários bancos. Instalações
anteriores que possuem vários perfis continuam legíveis em Ajustes; esta mudança
não apaga ou funde credenciais. O Client ID identifica a aplicação, não comprova
identidade da conta Meu Pluggy. A interface não promete uma verificação de titular
que o provedor não ofereceu.

Pausar impede novas admissões; uma execução em curso pode parar na próxima leitura,
preservando páginas publicadas. Atualizar um segredo exige o Client ID original.
Falhas respeitam a janela de 24h: o loading informa a próxima elegibilidade, sem
reiniciar uma execução terminal ou apagar o histórico. Fotos persistem no D1,
com preparação local e os limites do contrato. Rascunhos do onboarding bloqueiam
navegação e fechamento até salvar ou cancelar.

O instalador gera a chave de acesso, sem pedir senha. Guarda somente seu hash em
`ADMIN_ACCESS_HASH` e entrega um link privado no resultado do deploy; a primeira
tela oferece cópia com ClipboardText. `ADMIN_PASSWORD` anterior continua válido.
Credenciais Pluggy são validadas
no servidor e ficam no cofre privado já existente. Secrets Pluggy de ambiente
continuam como fallback das instalações anteriores; nenhum secret real é removido.

No frontend, `use-people-setup.ts` controla a navegação e os formulários;
`dashboard-view.tsx` apresenta a jornada. `setup-import.tsx` acompanha a fila real;
`use-household-editor.ts` mantém os ajustes avançados existentes.

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

O perfil inicial `default` usa os IDs recebidos da Pluggy. Outros perfis usam
`pluggy:<profileId>:<idCodificado>` em conexões, contas, transações, investimentos,
empréstimos e faturas. Apenas o adapter traduz para IDs brutos da API. Ele valida
Item/conta de origem antes de aplicar o prefixo. Nunca tenta outra credencial
quando um perfil falha ou está pausado.

O schema inicial cria pessoas, perfis e vínculos de titularidade. Novas conexões
recebem `default`/`self` no mesmo insert; o caso de uso pode atribuir o perfil
escolhido. Alterações de titular invalidam cursores para impedir paginação misturada.

## Credenciais e operação

Os secrets `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` continuam sendo a configuração
inicial do perfil `default`. A primeira utilização vincula sua aplicação por hash;
um Client ID diferente é recusado para impedir que o histórico mude de
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

Os testes usam somente dados fictícios. Cobrem titularidade inicial,
mais de dez conexões locais, isolamento entre aplicações com IDs iguais, escolha
de credenciais, rotação sem troca de aplicação, pausa, filtros, titularidade manual,
reatribuição e proteção das rotas administrativas. Validação no navegador usa uma
instalação Wrangler local separada. Isto não comprova consentimento real de duas
pessoas, disponibilidade de produtos por plano ou ampliação de limites do provedor.
