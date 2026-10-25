# Revisão de qualidade de código

Método: [thermo-nuclear-code-quality-review](https://github.com/cursor/plugins/blob/main/cursor-team-kit/skills/thermo-nuclear-code-quality-review/SKILL.md).
Escopo: diff completo de `main@27869b9` até o draft #12. A rodada começa em
`3f6bcf7`; os achados abaixo foram corrigidos na própria branch em `25359a1`.
Os números de linhas e os 99 comandos abaixo registram essa rodada. A integração
posterior com `main@17d037d`, incluindo o centésimo comando e as novas telas,
está documentada na seção 8 da [auditoria](architecture-audit.md).

## Achados confirmados e correções

### P2 — Registro duplicado dos comandos

`src/contracts/planning.ts` repetia os schemas das 99 ferramentas numa segunda
lista para acrescentar o discriminante `tool`. As allowlists do portal repetiam
a mesma construção. Uma ferramenta podia constar no catálogo sem entrar na
união interna, e os nomes precisavam ser mantidos em vários lugares.

O discriminante agora nasce junto da definição. Uma função local conserva a
inferência dos campos, defaults e permissão de leitura das 98 definições sem
refinamentos no objeto principal. O preview de regras mantém sua extensão
concreta com `safeExtend`, preservando a validação existente. A união interna é
derivada do registro; as allowlists externas continuam explícitas e reutilizam
os comandos prontos. Não há casts ou mecanismo genérico em outra camada.

O arquivo cai de **1.242 para 1.031 linhas**, e `workspace.ts` de **293 para 258**.
As variantes internas passam a seguir o registro por nome. A comparação verifica
cada variante pelo discriminante, sem tratar essa ordem interna como uma ordem
de apresentação. Schemas externos, defaults e ordem das opções permanecem iguais.

### P2 — Leituras atravessavam o protocolo de escritas

`src/worker/planning/service.ts` calculava digest para consultas, verificava duas
vezes a presença de chave idempotente e escolhia a leitura de tabelas com outro
teste de tipo de comando. Isso misturava dois fluxos que os contratos já distinguem.

A leitura encerra seu próprio caminho após verificar a revisão. Somente a escrita
calcula digest e procura o recibo. O recibo continua sendo consultado **antes** do
snapshot e da aplicação de regras, preservando replay; revisão, resultado e estado
continuam no mesmo commit. Confirmação e chave obrigatórias continuam nos schemas
das entradas externas.

### P2 — Duas identidades para invalidar a mesma leitura

`src/web/account/read-cache.ts` mantinha uma geração global e um token por chave.
Como `clear()` também limpa os tokens, uma resposta antiga já não pode recuperar
a identidade de sua requisição. A geração era redundante.

O token passa a ser a única condição de publicação. Permanecem expiração de dez
segundos, limite de vinte entradas, invalidação por escrita e proteção contra uma
resposta antiga sobrescrever refresh mais recente. Os testes de comportamento
existentes exercitam essas garantias.

### P2 — Suporte fictício no adaptador de demo

`src/web/demo-session.ts` declarava cinco handlers cujo único comportamento era
lançar `UNSUPPORTED_DEMO_OPERATION`. A tabela parecia completa, mas implementava
somente a consulta de contas.

A tabela agora descreve as capacidades realmente implementadas. Uma única recusa
trata as consultas ausentes, conservando o mesmo erro. O contrato compartilhado
com o painel e a inferência dos resultados não foram enfraquecidos.

## Arquivos grandes e limites

Nenhum arquivo do PR cruzou de menos de mil para mais de mil linhas. O catálogo
de contratos já tinha 1.261 linhas na base e tem agora 1.031; quase todo seu
conteúdo restante são as definições declarativas das ferramentas. O arquivo de
mutações tinha 1.680 e mantém 1.687 linhas, com estado compartilhado e commit único.
Dividir seus handlers somente para atingir um número moveria essa complexidade
e acrescentaria interfaces, sem eliminar decisões ou dependências. A rodada
removeu duplicação estrutural em vez de criar novos módulos por tamanho.

As cinco alterações de implementação removem **257 linhas líquidas**. Não foram
adicionados plugins de lint, dependências, casts, supressões ou novas camadas.

## Verificação

- `check:quick` passa sem desativar regras. O catálogo MCP regenerado não muda.
- Os 99 schemas de entrada, descrições, flags e allowlists do portal permanecem
  idênticos à base. As 99 variantes internas conservam seus schemas por nome.
- Probes locais confirmam a consulta de contas do demo, a recusa de consulta não
  suportada, a validação do preview refinado e a recusa de escrita sem confirmação.
- `mise run check` passou: 80 testes Node, 156 testes Cloudflare em 26 arquivos,
  build e runtime nativo com 10 mil e 100 mil registros, replay e reinício. A CI
  do commit entregue fica registrada no PR.

Esta revisão não comprova execução de Pluggy/OAuth externos ou de um host MCP real.


Na integração final, o demo conserva os quatro handlers recebidos da main. A
validação completa passou com 96 testes Node, 169 testes Cloudflare em 28 arquivos,
build e runtime nativo de 10 mil e 100 mil registros. Os 100 schemas de entrada,
metadados e allowlists coincidem com `main@17d037d`.
