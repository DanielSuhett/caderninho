# 04: Manter consumo ocioso constante e escrita proporcional à mudança

**What to build:** histórico antigo não aumenta o custo do dia sem atividade;
rotina diária, maturação e manutenção examinam apenas conjuntos necessários,
preservando cobertura financeira e recuperação.

**Blocked by:** 02 — Trabalhar uma vez por dia e consolidar avisos da origem.

**Status:** rascunho histórico da divisão original; implementação e evidências no [aceite](../aceite.md). Não publicado em tracker.

## Critérios originalmente propostos

- [ ] Admissão, trabalho pendente e ausência de candidatos a limpeza usam buscas
  seletivas. Na fixture ociosa da spec, ficar abaixo de 100 linhas lidas e 10
  escritas/dia; ampliar o histórico dez vezes não aumenta essa parcela de forma
  linear. Lotes de manutenção com backlog têm orçamento separado e explícito.
- [ ] Limpeza diária limitada não revisita payloads já esvaziados, não toca dados
  financeiros/regras referenciadas e preserva identidade de Tasks e idempotência.
  Dimensionar capacidade de drenagem e retenção sem apagar executor ativo;
  provar em banco vazio e upgrade qualquer migração de índices necessária.
- [ ] Maturação não varre toda a conta; virada de dia permanece correta com sync
  pausado, sem polling ou mutações escondidas em GET. Progresso técnico não muda
  revisão financeira por si só; cursores continuam detectando mudanças reais.
- [ ] Medir publicação nova, observação inalterada e reconciliação. Evitar escritas
  dispensáveis no incremental sem quebrar frescor e replay; manter marcação de
  vistos na reconciliação, salvo alternativa comprovadamente equivalente e mais
  barata. Avaliar índices redundantes e checks de cursor com custo total, não
  só velocidade. Não criar estruturas auxiliares sem ganho medido.
- [ ] Fixtures reais de statements atendem aos tetos de incremento e reconciliação
  da spec; medir também bootstrap e backlog sem pressupor gratuidade. Testes de
  remoção de ausentes, rollback, precisão, moedas, proveniência e idempotência
  passam junto dos checks completos. Registrar métricas e limites de cada cenário.

## Demonstração

Rodar um dia ocioso em duas bases com históricos de tamanhos diferentes: consumo
praticamente constante. Executar reconciliação sintética completa e demonstrar
que ausentes somem, presentes continuam e valores/overrides não mudam indevidamente.
