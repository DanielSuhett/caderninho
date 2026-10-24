# QA visual — Kumo e demonstração pública

final result: pass

## Resultado local em 24/10/2026

Revisão concluída com 8/10 qualitativo em cada uma das 14 páginas, após três rodadas
com agente independente no papel de designer crítica. Aprovação limitada às
capturas e interações registradas; não é aprovação humana nem de produção.
[Relatório por página](docs/kumo/revisao-critica-03.md),
[galeria](docs/kumo/capturas/README.md) e
[dados/contraste/bundle](docs/kumo/dados-e-evidencias.md).

## Cinco superfícies verificadas

| Superfície | Evidência atual |
| --- | --- |
| Tipografia | Inter local; conteúdo e controles 16 px, metadados 14 px, títulos 28/20px, métricas 32/26 px e moeda subordinada. Peso máximo 600 e tracking original. |
| Espaço e alinhamento |14 páginas desktop/móvel com grade 12/4 colunas, gutter 24/16 px e baseline 8 px. Eixos de headings, toolbars, linhas, valores e chevrons inspecionados. Sem overflow horizontal nas larguras testadas. |
| Cor e contraste | Neutros reforçados; quatro pares amostrados entre 9,16:1 e 18,73:1. Cor reservada a ação/estado; laranja de consumo público restaurado, com denominador/estimativa e 103% no texto. |
| Imagens e ícones | Phosphor real e componentes Kumo compilados. Galeria de screenshots atuais, sem mockup apresentado como implementação. Capturas transitórias/sem CSS foram rejeitadas. |
| Copy e conteúdo | Parcialidade, moeda, período, classificação, consequência e recuperação visíveis. IDs recolhidos; transações móveis compactas; categorias e referência descobertas. Textos legais preservados. |

## Estados e interações

Desktop 1541×863; móvel emulado 391×845. Cobertura detalhada na galeria e revisão 03.
Overview: parcial, política aberta, categorias, série/tabela, recentes, contas,
primeiro banco, falha da série e falha do chunk gráfico com alternativa exata.
Transações: lista, vazio, erro, carregamento, busca, filtros, calendário pt-BR,
intervalo civil 1–24 out, detalhe e parcelas pendentes/futuras. Regras/grupos:
expandido, editor, rascunho, descarte/continuidade, exclusão e catálogo. Operação:
importação ativa/falha, histórico expandido, perfis/pessoas, URL MCP, grants,
atividade/requisições, modelos/bytes e confirmação de revogação cancelada.
Público: hero, instalação, desempenho/método, CPU/cotas/premissas, FAQ, acesso
normal/erro/recuperação, consentimento e 404. Demo: período/moeda, busca GET e detalhe.

Sidebar móvel: foco inicial, cicloTab, Escape, retorno ao gatilho e bloqueio de
navegação durante edição exercitados na migração. Roots de LayerDialog continuam
montados. A rodada de polimento confirmou visualmente diálogos/ações completos,
rascunho preservado e retorno de foco nos fluxos exercitados. Não extrapolar isso
para conformidade total de acessibilidade ou todos os dispositivos.

## Verificação técnica

`mise run check` final passou em 24/10/2026: tipos, formato, lint,44 testes Node,
108 testes de integração em 19 arquivos, build/dry-run e runtime local Workflow/D1.
Runtime cobriu 10 mil/100 mil registros, cliente desconectado, falha parcial,
replay, recomeço e persistência após reiniciar. Agregados completos foram testados
com mais de uma página, moedas separadas e dinheiro acima do inteiro seguro JS.
A leitura por portal validou o envelope real do serviço e a rejeição por CSRF.

O runner Vitest/workerd ainda emite avisos da dependência opcional
`@emotion/is-prop-valid` no pacote Kumo; todos os testes passaram. Não foi ocultado
o diagnóstico nem instalada dependência só para silenciar o log.

## Inferências e limites

Variação visual baixa entre páginas e moderada entre papéis da informação;
densidade moderada nas listas e maior quando detalhes técnicos estão abertos.
Transações móvel usa nome/valor e conta/data em duas bandas. Dashboard é mais
longo por comportar análises. Movimento parece baixo no uso observado e o gráfico
não anima; screenshots estáticos não medem movimento. São inferências qualitativas.

Preview privado é sintético. Demo é ledger fictício isolado, também aberto no
Worker local sem sessão. Sem push/deploy, OAuth/Pluggy reais, operações financeiras,
revogação real ou validação em host MCP. A evidência de 404 visual usa o componente
local; o build gera 404.html para o site, sem alegar comportamento publicado.
