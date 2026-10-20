# 05: Instalar e validar o produto mínimo com duas tabelas

**What to build:** Uma instalação nova permite entrar com senha, conectar o Meu Pluggy, importar, autorizar o MCP e consultar histórico e totais usando somente duas tabelas da aplicação: connections e transactions, com nove colunas cada. O JSON de contas tem somente os cinco campos por conta definidos no ticket 03 e a chave de identidade. A entrega remove dados redundantes, código e documentos sem função, em um pacote npm e um deploy.

**Blocked by:** 01 — Acessar o painel e autorizar o MCP sem sessões no D1; 03 — Consultar transações sem repetir dados da conexão ou da conta; 04 — Importar e retomar pelo estado corrente da conexão.

**Status:** resolved

- [x] O schema inicial aplicado em D1 vazio cria somente connections e transactions como tabelas da aplicação, com as nove colunas de cada contrato mínimo. Não esconder os campos cortados em JSON: contas usam somente os cinco valores conhecidos por chave de conta; checkpoint usa somente fase, conta e cursor. Tabelas internas da plataforma não entram na contagem. Não há seed de settings, migrações legadas nem reset automático em deploy. Os dados persistem após reiniciar o Worker.
- [x] Um cenário integrado com dados sintéticos cobre login, widget de conexão/reconexão, importação, consulta paginada, totais exatos e autorização/revogação OAuth. O MCP anuncia somente status, sync, transactions e aggregate. Reimportar uma origem com janela menor preserva o histórico e seus totais elegíveis, inclusive após reinício.
- [x] Provar o limite de segurança com a instalação final: visitantes, cookies adulterados/expirados e tokens MCP isolados não emitem Connect Tokens, não cadastram conexões e não aprovam consentimento como proprietário. Credenciais Pluggy e a senha não aparecem em respostas, logs ou assets. O Connect Token limitado continua sendo o único segredo Pluggy entregue ao widget.
- [x] Cada campo persistido tem uma justificativa observável: consulta financeira, saldo com referência temporal, autenticação da origem ou retomada da importação. Eliminar serializadores, filtros, tipos, índices e joins dedicados aos campos cortados, incluindo seletores que exigiam connection_id junto do account_id. Remover código, exports, portas, wrappers, dependências, fixtures, tarefas e testes sem consumidor; não esconder a mesma complexidade em JSON/camadas genéricas. Atualizar documentação ativa, glossário e instalação sem restaurar documentos históricos apagados. Registrar redução de tabelas, colunas de transação, ferramentas e código, sem metatestes de fontes/configuração.
- [x] Checks locais completos e o harness nativo passam, incluindo importação de 100 mil registros, precisão monetária, paginação, replay, recuperação de falha e persistência após reinício. Relatar separadamente evidência sintética/local e o que depende de provedor/host reais. Este ticket não autoriza deploy, provisionamento, reset ou escrita em recursos remotos; a reinstalação Cloudflare anteriormente cancelada permanece fora do escopo.

## Evidência de conclusão

`installation.test.ts` verifica D1 vazio (duas tabelas × nove colunas; JSON de conta
com cinco valores e checkpoint com três), login → widget conexão/reconexão →
importação paginada → MCP/totais exatos → grant/revogação OAuth. A/B → B atualizado/C
conserva A e total BRL `900719925474099306`. SDK visual e despacho são sintéticos;
adapter HTTP Pluggy, serviços, D1 e biblioteca OAuth executam localmente.

Testes HTTP e o harness verificam a barreira do proprietário, ausência de
credenciais em respostas/logs/assets, precisão, replay, rollback, falha parcial,
100 mil transações, paginação e reinício. `mise run check` completo passou com
17 testes Node e 42 de integração, build dry-run e harness nativo. As revisões
Standards/Spec tiveram um achado cada, corrigidos e reconferidos sem pendências.
A regressão de catálogo temporariamente incompleto preserva páginas confirmadas e
o último sucesso. Evidência local: `work/implementation/minimo-funcional/`.

Redução desde `cc59a79`: seis → duas tabelas, vinte → nove colunas por transação,
seis → quatro tools, 77 → 73 arquivos TS e 6.615 → 5.246 linhas TS (−20,70%). O
método considera `.ts`/`.tsx` em `src`, excluindo testes e tipos gerados. Contratos,
documentação ativa e justificativa de cada campo estão em
`docs/cloudflare-product.md`; código e documentos sem consumidor foram removidos.

Aceito na integração `refactor/minimo-funcional`, código final `6635a75`. Não houve
push, deploy, provisionamento, migração ou acesso remoto Cloudflare. Pluggy real,
instalação em conta nova e consentimento em host MCP real permanecem fora da
evidência local; a reinstalação cancelada não foi retomada.
