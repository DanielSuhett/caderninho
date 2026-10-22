# Regras e grupos no navegador

Implementação local na branch `codex/rules-groups-backoffice`.
Referência: [opf-cli PR #1](https://github.com/DanielSuhett/opf-cli/pull/1),
`docs/categorization.md` em `c8792595b05f0c1ca10310a7fec4b39c889d1241`.

## Jornada

Em `/account/rules`, Nova regra abre o editor lateral. Nome, categoria,
prioridade e estado ficam separados das condições. Os presets Supermercados,
Assinaturas, Salário e PIX enviados substituem somente os filtros; não escolhem
categoria nem presumem transferências entre contas próprias. Os valores de
preset são sugestões editáveis, em BRL.

Cada alternativa exige **todas** as suas condições (E). Basta corresponder a
uma alternativa (OU). São permitidas quatro alternativas com oito condições
cada. Há descrição literal, movimento, estado, conta, pessoa, data e magnitude
monetária. Valores exigem moeda explícita e permanecem exatos em unidades mínimas.
ASCII A–Z ignora caixa; acentos continuam literais, como na regra anterior.

A prévia espera 500 ms sem alteração de filtro, cancela a consulta substituída e
ignora respostas antigas. Alterar nome, categoria ou prioridade não refaz a
consulta. Há contagem junto às ações fixas e até cinco amostras com pessoa,
conta, data e valor. A consulta examina no máximo 10 mil registros: acima disso,
informa contagem parcial, nunca um total exato. Também sinaliza fontes parciais.

**Correspondência não significa alteração:** a prévia não simula a precedência
entre regras, não deduz se a categoria já seria a mesma e não escreve dados.
Menor prioridade vence, com desempate por ID. Salvar vale para próximas
importações; reclassificar histórico continua sendo uma ação explícita pelo MCP.
Excluir regra preserva classificações anteriores.

Em `/account/groups`, Novo grupo cria um espaço, com nome, tipo, moeda e dia de
início do mês. Editar preserva a moeda original. Grupo não concede acesso nem
muda o titular de uma conta. O grupo pessoal é protegido; excluir outro grupo
exige ausência de contas, regras, categorias próprias e demais vínculos. Não há
exclusão em cascata de dados financeiros.

Editar e excluir ficam no detalhe aberto pelo item inteiro. O editor mantém o
rascunho quando a escrita falha, impede envio duplicado e confirma descarte.
Cancelar, Escape e Voltar com rascunho mantêm o editor até a decisão; descartar
fecha o editor na página atual. Recarregar/sair usa a proteção nativa do browser.

## Contratos e persistência

- `POST /api/account/planning`: sessão, origem, CSRF e lista explícita das seis
  operações CRUD de regras/grupos. Escritas usam o serviço existente, revisão
  atômica e recibo idempotente; erro de chave reutilizada retorna 409.
- `POST /api/account/rule-preview`: somente leitura autenticada, validação estrita,
  revisão consistente e consulta limitada. Não invalida o cache de leituras.
- `create_rule` / `update_rule`: novo `filter` opcional, preservando os campos
  legados. Predicados legados são combinados por E com o filtro composto.
- `delete_space`: nova tool MCP com confirmação explícita e idempotência.
- Migração `0006_rule_filters.sql`: substitui apenas o trigger para novas
  transações. Comparações monetárias SQL usam comprimento e ordem lexical das
  magnitudes canônicas, sem converter para ponto flutuante.

O frontend envia no máximo 32 KiB por ação. A prévia tem limite de registros por
consulta; debounce reduz chamadas da interface, não representa rate limit global.
Dados de contraparte/documento e bibliotecas nomeadas de JSONLogic do PR não são
oferecidos: não existem no modelo local atual. Nenhum dado privado do PR foi
importado.

## Evidência local

Os testes de integração usam D1 real no runtime local: CRUD HTTP, whitelist,
CSRF, idempotência, preservação financeira, grupo protegido/ocupado, limite da
prévia e paridade E/OU entre prévia, importação e aplicação explícita. Testes Node
cobrem texto literal, IDs, valores acima de IEEE-754 e conversão decimal do editor.

A instalação sintética `127.0.0.1:8793` foi usada para criar e editar regra e grupo,
abrir/cancelar exclusão e conferir prévia. Exclusão efetiva é verificada na suíte
isolada. Capturas e medidas ficam em `work/backoffice-review/` (ignorado pelo Git).
Não houve push, deploy, migração remota, consulta Pluggy real ou validação em host
MCP externo nesta etapa.

Verificação concluída em 22/10/2026: `mise run check` passou com 25 testes Node,
79 testes de integração, build dry-run e Workflow/D1 com 10 mil e 100 mil registros.
Após o polimento visual, tipos, formatação, lint e build do portal foram repetidos.
No navegador, três mudanças rápidas do mesmo campo produziram um único POST de
prévia adicional; a contagem voltou a 13 correspondências em 80 registros.
A designer revisou capturas desktop e mobile. Controles de formulário têm 44 px;
no mobile de 391 px não houve overflow, e os dois botões de rodapé têm mesma
largura e altura. Evidências específicas em `work/backoffice-review/`.
