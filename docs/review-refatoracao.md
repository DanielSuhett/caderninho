# Revisão da refatoração

Base: `f1f6876`. Implementação inicial: `5576399`. Revisões independentes de
Standards e Spec, executadas em paralelo em 19/10/2026, com verificações locais
sintéticas. A spec aprovada está em [spec-refatoracao.md](spec-refatoracao.md).

## Standards

**P2: recusa de capacidade tratada como falha inesperada.** O erro encapsulado
do trigger D1 não coincidia com `ITEM_LIMIT`, produzindo HTTP 500 e classificação
interna. Isso contrariava a política de recusas esperadas de
[CONTRIBUTING.md](../CONTRIBUTING.md). O repositório agora normaliza somente esse
erro conhecido para `ITEM_LIMIT`; a regressão verifica HTTP 409 e classificação
de recusa esperada.

O apontamento inicial de violação do limite concorrente foi retirado: o trigger
`connection_limit` do schema inicial já impede atomicamente a 11ª conexão. A
reprodução inicial do revisor usava um repositório falso e não executava o trigger.

A regressão adicionada usa D1 e confirma que somente uma das duas inscrições
concorrentes vence a partir de nove conexões; a revisão não avança pela inscrição
recusada, e a reconexão de um ID existente continua permitida.

Nenhum achado sustentado pelos heurísticos de Fowler.

## Spec

1. **P2: intervalo da última coleta concluída perdido após falha.** O intervalo
   era compartilhado com a tentativa atual. Foram separados os dois pares de
   datas; somente finalizar a conta promove o intervalo concluído, no mesmo batch.
   A regressão cobre tentativa parcial e enumeração concluída vazia.
2. **P2: erro MCP genérico impedia ação do cliente.** Filtros, configuração,
   indisponibilidade da origem e falhas de importação agora têm códigos públicos
   explícitos. A regressão de protocolo verifica os códigos e a omissão da mensagem
   privada do banco. Configuração ausente não consome a janela de admissão.

Nenhum aumento indevido de escopo foi identificado. Pluggy real, provisionamento
pelo Deploy Button e hosts MCP externos permanecem validações separadas, conforme
o [relatório de evidências](validation-refatoracao.md).

`mise run check` passou após as correções, incluindo as regressões citadas.

Standards: 1 achado, maior gravidade P2, corrigido; Spec: 2 achados, maior gravidade
P2, corrigidos. Nenhum achado aberto em qualquer dos eixos.
