# 09: Integrar e verificar o lançamento enxuto em instalação nova

**What to build:** Uma instalação vazia executa a jornada completa: conectar,
autorizar, importar, consultar, agregar, corrigir e continuar após outro deploy.
Só existem os conceitos, ferramentas e dependências do lançamento simplificado.

**Blocked by:** 06: Responder totais financeiros exatos e honestos;
07: Corrigir transações localmente sem perder edições na importação;
08: Manter a cópia diária e recuperar despachos sem operações duplicadas.

**Status:** done

- [x] Jornada completa usa as seis tools novas e o painel com autenticação/OAuth;
  correção afeta agregados e um novo deploy preserva registros financeiros. Não
  existem aliases/rotas funcionais para regras, outros produtos ou execução legada.
- [x] Verificação final remove apenas remanescentes: tabelas/views antigas,
  normalização universal, Tasks customizadas, webhooks, R2/migração, dependências,
  exports, configurações e fixtures sem consumidores. Não desligar lint/checks
  nem apagar cobertura financeira/security relevante para obter verde.
- [x] Medição com 10 mil e 100 mil transações, múltiplas contas e páginas reais
  registra correção de resultados, tempo, memória e limites; memória não cresce
  com todo o extrato. Inviabilidade da releitura diária exige revisar a spec,
  não truncar registros ou reintroduzir complexidade silenciosamente.
- [x] README, instalação, uso, arquitetura, exemplos e glossário concordam com
  banco novo, seis tabelas e escopo de contas/transações. Não há instruções de
  upgrade, schema paralelo ou credenciais adicionais desnecessárias.
- [x] Checks completos e runtime local passam na branch de integração. Evidências
  distinguem testes sintéticos/build de provisionamento, Pluggy e host MCP reais;
  não executar deploy, merge ou mudança remota como parte deste ticket.

Evidências: `docs/validation-refatoracao.md` e `docs/review-refatoracao.md`.
`mise run check` passou com 20 testes Node, 31 integrados e o harness nativo de
Workflow/volume/persistência. RSS inclui workerd/D1 local e não mede heap isolado;
Pluggy, Deploy Button e hosts MCP reais continuam como limites externos explícitos.
