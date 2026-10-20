# Evidências da refatoração de contas e transações

Validação local em 19/10/2026, sobre a main `f1f6876`. Todos os dados e credenciais
dos testes são sintéticos. Esta evidência não representa deploy ou coleta bancária real.

## Resultado funcional

O schema inicial instala seis tabelas. O contrato tem seis tools comuns do SDK,
com OAuth oficial. A coleta usa um Workflow por conexão, checkpoint sequencial,
último recibo e publicação atômica. Não há locks, login_attempts, motor de regras,
Tasks customizadas, webhooks, R2 ou recursos financeiros adicionais no runtime.

Os testes cobrem dinheiro de 30 dígitos, moedas separadas, BANK/CREDIT, pendentes,
futuros, zero, precisão desconhecida, correções por campo e edição concorrente.
IDs substituídos/ausentes preservam o histórico e tornam os subtotais parciais.
Categorias indicativas e transferências sem prova permanecem débitos incertos.

D1 real do harness demonstra disputa de admissão, pausa/cooldown, rollback de
página, execução inexistente/encerrada, singleton ausente, replay concorrente,
retenção e rejeição de cursor após mudança da revisão/qualidade.
As regressões finais também verificam que a tentativa parcial conserva o intervalo
da coleta anteriormente concluída, e que uma enumeração vazia concluída substitui
esse intervalo por nulo. A disputa pela décima conexão usa o repositório real e
verifica rollback da revisão, além de permitir reconectar um ID existente.

## Workflow nativo e volume

O harness Wrangler/workerd executa múltiplas contas e páginas de 500 registros,
sem manter o extrato inteiro em JavaScript. Os totais são calculados no SQL, com
parcelas inteiras e reconstrução BigInt; os valores ultrapassam int64/Number seguro.

| Registros | Tempo observado | Pico RSS workerd |
| --- | --- | --- |
| 10.000 | 3.831 ms | 398.020 KiB |
| 100.000 | 32.481 ms | 473.340 KiB |

RSS mede o processo local completo, incluindo o emulador e o armazenamento D1.
Não é medição isolada do heap do Worker e não comprova o orçamento de memória/CPU
em produção. A limitação de buffers por página é visível no algoritmo/fixture;
o aumento do cache/armazenamento do emulador não representa carregar todo o extrato
na aplicação. Não há asserts de duração ou RSS na CI.

O runtime também confirma:

- Continuação após o cliente HTTP inicial desconectar.
- Falha terminal preservando a página confirmada e qualidade parcial.
- Resposta perdida após commit: retry recupera o recibo e não consulta a página
  na origem novamente. O teste recusa explicitamente essa segunda leitura.
- Persistência do banco após reiniciar o Worker local.

O teste de resposta perdida detectou que propriedades de Error não atravessavam
o RPC de retries. O adapter agora registra um resultado de falha pequeno e tipado,
com código seguro e atraso, e chama sleep fora de step.do. O orçamento é de três
retentativas por página, com retries nativos adicionais desabilitados.

## Interface e segurança

No Chrome, um Worker separado confirmou login, carregamento React, pausa,
retomada, importação sintética de 1.202 registros, qualidade das duas contas e
logout. Os controles reutilizam Kumo e têm rótulos acessíveis. O widget tem testes
de descarte, aberturas concorrentes e callbacks antigos. Isso não comprova o
widget/conector real nem um host MCP externo.

OAuth sintético cobre autorização, tools e revogação de todos os grants. Login
cobre cookies, CSRF, origem, versão, expiração e chave do limiter por IP confiável.
Diagnósticos verificam isolamento concorrente, erro MCP com HTTP 200, redação,
falhas de stream e observadores que não alteram o resultado da aplicação.
O erro MCP identifica filtro inválido, configuração ausente e falha da importação,
sem incluir a mensagem privada do banco. Sem credenciais, uma nova importação
é recusada antes de reservar a janela de 24 horas. A correlação do diagnóstico
MCP também é comparada ao `X-Request-ID` da resposta HTTP real do harness.

## Checks e limites externos

`mise run check` passou após as correções da revisão: tipos gerados, TypeScript,
layout, lint, 20 testes Node, 31 testes integrados, build dry-run e o harness
nativo de Workflow/volume/persistência. O log local é
`work/tmp/check-final-refatoracao.log`; a medição acima pertence a essa execução.
A [revisão por Standards e Spec](review-refatoracao.md) encerrou sem achados abertos.

Ainda exigem execução separada: Deploy Button em conta nova, Pluggy real, OAuth
num host MCP real e telemetria/limites remotos. Nenhum deploy, push, merge,
migração remota ou alteração de dado financeiro real foi executado nesta entrega.
