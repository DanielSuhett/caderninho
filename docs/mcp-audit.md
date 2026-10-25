# Auditoria do MCP

`/account/audit` mostra autorizações OAuth, último uso por cliente, requisições,
chamadas de ferramenta, bytes e falhas. A tela exige a sessão da instalação.
A tabela `mcp_audit` e seus índices fazem parte do schema inicial da instalação.

## O que é observado

- O cliente vem do contexto autenticado do OAuthProvider, não de `User-Agent`,
  `clientInfo` ou um cabeçalho que o solicitante possa forjar. O nome amigável é
  declarado pelo cadastro OAuth e não comprova a identidade de uma pessoa.
- Autorizações cadastradas não significam conexão online. A última atividade é
  por **cliente**, não por concessão individual, limitada à janela consultada e à
  lista de até 100 clientes. Ausência significa “Não registrado”, não “Nunca usou”.
- Uma linha corresponde a uma requisição autenticada que chega ao handler MCP.
  `tools/list` e operações do protocolo entram no total de requisições;
  `tools/call` também entra no total de chamadas. Tentativas rejeitadas antes da
  autenticação não entram neste painel.
- Falha HTTP, erro de stream/encerramento e resultado `isError` da ferramenta
  contam como falha. Uma ferramenta pode falhar com HTTP 200. Erros do protocolo
  com HTTP 200 sem passar pelo handler da ferramenta não são classificados pelo
  conteúdo do corpo. O painel não mede a correção da resposta posterior da IA.
- Entrada mede bytes do corpo consumidos pelo Worker; saída mede bytes produzidos
  no stream da resposta. Inclui o envelope JSON/SSE, sem cabeçalhos, TLS e
  compressão de rede; enfileirar bytes não comprova recebimento pelo cliente.
  Interrupções podem ter volume parcial. Não é medida de tokens ou custo da IA.

Duração vai do início do handler ao fechamento/interrupção do corpo, incluindo
espera pelo consumo do stream. Não equivale à latência de geração do modelo.
Falhas e interrupções são categorias separadas; uma interrupção encerra o registro
uma única vez. Falha na persistência não repete a ferramenta nem substitui sua
resposta: a auditoria é best effort e pode ter lacunas.

## Modelo: declaração opcional, sem inferência

O MCP não permite deduzir qual modelo um cliente externo usa. Um cliente que queira
informar isso pode incluir metadados na chamada:

```json
{
  "method": "tools/call",
  "params": {
    "name": "get_spaces",
    "arguments": {},
    "_meta": { "caderninho.app/model": "provider/model-name" }
  }
}
```

O exemplo mostra apenas o campo adicional, não substitui o envelope e metadados
exigidos pela versão MCP negociada. A declaração aceita até 100 caracteres ASCII
alfanuméricos e `._:/-`, começando por um alfanumérico. Ausência/formato inválido
vira `null`, exibido como **Não informado**. O valor é declarado e não verificado;
não deve embasar cobrança, atribuição de responsabilidade ou comparação de qualidade.

A taxa de erro por modelo é `falhas / chamadas de ferramenta`, incluindo chamadas
interrompidas no denominador. Contagem, falhas e percentual aparecem juntos. Não
há estimativa automática de custo ou tentativa de adivinhar modelo pelo cliente.

## Janela, retenção e privacidade

A consulta oferece 24 horas, 7 ou 30 dias, em janela móvel; dias são agrupados em
UTC. A série mostra dias com atividade. Totais usam todos os registros da janela;
as listas exibem até 100 modelos/clientes e 50 eventos recentes. As autorizações
OAuth têm paginação independente de 20 itens.

O banco guarda somente IDs, horário, ferramenta conhecida (ou `unknown`), modelo
declarado, resultado, status, contagens de bytes e duração. Não guarda argumentos,
conteúdo de transações, respostas financeiras, prompts, senhas ou tokens. O campo
modelo aceita informação declarada pelo cliente: este não deve enviar PII nele.

Cada gravação remove registros anteriores a 30 dias do início da nova requisição.
Sem nova atividade eles podem permanecer fisicamente armazenados, mas ficam fora
da janela exibida. Isso não é uma política automática de expiração em uma
instalação ociosa. Há custo de escrita D1 por requisição e leitura por janela;
esta implementação é para instalação pessoal, sem benchmark de tráfego alto.

## Revogar um assistente

“Revogar acesso” revela o nome e pede confirmação. O POST valida origem, JSON,
sessão, CSRF e propriedade da concessão antes de chamar o provedor OAuth. Só a
concessão escolhida é revogada; as outras permanecem. Revogar não apaga o histórico.
Tokens/segredos nunca são enviados à tela. Registros expirados ainda presentes no
provedor exibem a data de expiração nos detalhes; não são prova de acesso vigente.

## Evidência

`tests/integration/audit.test.ts` percorre OAuth local, chamada MCP, D1, API da tela
e revogação. Verifica UTF-8, erro de ferramenta em HTTP 200, headers forjados,
modelo ausente, CSRF, isolamento da revogação, retenção e stream cancelado/com erro.
O teste não comprova OAuth com ChatGPT/Claude, Pluggy real ou telemetria em produção.
A composição visual segue o [guia de componentes](design-system.md).
