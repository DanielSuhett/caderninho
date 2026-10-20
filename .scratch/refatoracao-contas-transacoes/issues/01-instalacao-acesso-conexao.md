# 01: Instalar do zero, autenticar e registrar uma conexão

**What to build:** O proprietário inicia uma instalação vazia, entra no painel
com sua senha, autoriza um assistente e registra uma conexão válida do Meu Pluggy.
Painel e status mostram que a conexão existe e ainda não tem dados importados.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Instalação cria o schema novo de seis tabelas e a configuração inicial sem
  consultar bancos anteriores; repetir o preparo não apaga dados já gravados.
- [x] Login, logout, CSRF, cookies e expiração de oito horas funcionam pelas rotas
  reais. Limitação nativa por IP substitui o contador D1 sem gravar IP em logs/banco.
- [x] Consentimento OAuth permite chamar o novo status e revogar assistentes,
  sem permissões por conta ou conexão e sem expor secrets ou payloads privados.
- [x] Registro valida a conexão na origem, aceita só Meu Pluggy, é idempotente
  para a mesma conexão e respeita o limite de dez. A interface distingue conexão
  de conta e não apresenta histórico ausente como saldo zero.
- [x] Testes de jornada usam dados sintéticos e entradas reais. A fatia define o
  ponto de entrada do novo runtime sem restaurar rotas/features fora do escopo;
  evidência local é distinguida de provisionamento/OAuth externos.

**Evidência:** [validação local](../../../docs/validation-refatoracao.md); fixtures sintéticas e testes correspondentes em `tests/integration`. Provisionamento, Pluggy e host MCP reais não foram executados.
