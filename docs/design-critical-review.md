# Crítica de produto: um painel que dá confiança no MCP

Data: 22/10/2026. Base observada: `8e7fc7e`. Revisão feita com a skill
Product Design / audit, pesquisa oficial e leitura dos componentes. O papel desta
designer é reduzir esforço para conferir dados, conectar um cliente e entender uma
falha. O painel apoia o MCP; não precisa disputar atenção com o assistente.

## Evidência local desta rodada

As três capturas abaixo foram feitas nesta rodada pelo agente principal e abertas
pela designer. Os dados são fictícios. Não são capturas reaproveitadas da entrega
anterior. A resolução dos arquivos é 1265 × 890 px.

1. **Transações — funcional, densa em instruções e espaçosa em controles.**
   O nome da página aparece também na navegação e no eyebrow. O primeiro registro
   começa depois de aproximadamente 690 px. Apenas um registro completo aparece
   na primeira tela. A separação de titular, conta, categoria e valor é clara.
   Evidência: `work/design-audit/01-transactions-before.jpg`.
2. **Visão geral — identificação correta, hierarquia grande demais.**
   O titular é visível e valores preservam sua moeda. Título, instrução, seletor,
   mensagem redundante e métricas deixam a primeira conta abaixo de 650 px.
   Evidência: `work/design-audit/02-overview-before.jpg`.
3. **Conexões — jornada existente, prioridade dividida.**
   Importar e conectar usam o mesmo destaque. Uma frase sobre saldos aparece mesmo
   antes de uma seção de gestão, consumindo altura sem ajudar a próxima ação.
   Há uma boa distinção entre titular e perfil de origem, que deve permanecer.
   Evidência: `work/design-audit/03-connections-before.jpg`.

![Transações antes do polimento](../work/design-audit/01-transactions-before.jpg)
![Visão geral antes do polimento](../work/design-audit/02-overview-before.jpg)
![Conexões antes do polimento](../work/design-audit/03-connections-before.jpg)

Os arquivos ficam no diretório local ignorado pelo Git; as referências acima são
para a revisão neste checkout. Os achados não dependem da publicação dessas imagens.

## Referências oficiais: o que aproveitar e o que deixar de fora

Os produtos foram identificados pelos domínios e documentação oficiais. Visor é
**visorfinance.app**, não o homônimo `visor.vin`. Dinzo é **dinzo.com.br**. Securo é
**usesecuro.com**, ligado ao repositório `securo-finance/securo`.

| Referência | Evidência pública | Decisão para Caderninho |
| --- | --- | --- |
| [Visor Finance](https://visorfinance.app/) e [guia MCP](https://help.visorfinance.app/pt-BR/articles/1755006-como-conectar-ao-servidor-mcp-do-visor) | Organiza a proposta por decisões financeiras e oferece consultas, organização e gráficos pelo MCP. A documentação distingue permissões e confirmações. | Manter resultados e ações legíveis. Levar análise e gráficos sob demanda ao MCP. Não importar o peso visual de uma landing de aquisição para cada página operacional. |
| [Dinzo](https://dinzo.com.br/) e [ajuda sobre conexões de IA](https://ajuda.dinzo.com.br/hc/central-de-ajuda-dinzo/pt_BR/categories/organizar-e-entender-seus-numeros) | O painel complementa outras jornadas. A ajuda descreve cliente conectado, permissão, último uso e desconexão. [Imagem oficial do painel](https://dinzo.com.br/v3/dash/visao-geral.jpg). | A gestão de acesso precisa ser um produto visível, não só um endpoint para copiar. Não adotar mascote, gamificação ou chat local: isso muda o centro do Caderninho. |
| [Securo](https://www.usesecuro.com/en), [documentação](https://docs.usesecuro.com/docs) e [Agents](https://docs.usesecuro.com/docs/features/agents) | A proposta valoriza controle local. Agentes internos podem ter provedor/modelo configurados; ferramentas e propostas têm controles próprios. | Adotar a clareza sobre origem e autorização. Não confundir o modelo de um agente interno com a identidade de um cliente MCP externo: o servidor não controla qual modelo esse cliente executa. |

### Comparação visual observada

Três referências foram capturadas nesta rodada pelo agente principal e abertas
pela designer: `work/design-audit/reference-dinzo.jpg`,
`work/design-audit/reference-visor.jpg` e `work/design-audit/reference-securo.jpg`.

- **Dinzo — imagem oficial do painel:** título compacto, barra de ações no topo,
  navegação segmentada e grupos nomeados. Contas, assinaturas e metas compartilham
  a tela sem precisar de títulos grandes. O grande resumo azul, o mascote e a
  gamificação são identidade e escopo próprios; não são recomendação para o
  Caderninho. Aproveitar a economia de cabeçalho e a proximidade entre dado e ação.
- **Visor — landing pública:** CTA principal azul, CTA secundário neutro e hero
  dominante com ilustrações. O contraste entre ações é claro, mas a escala da
  página é de aquisição. Reproduzi-la em Transações repetiria justamente o problema
  observado de conteúdo útil abaixo da dobra. A captura inclui aviso de cookies;
  não representa o dashboard autenticado do Visor.
- **Securo — dashboard publicado dentro da documentação:** a imagem mostra
  cabeçalho de período compacto, resumo numérico, distribuição por categorias,
  gráfico de saldo e transações na mesma área. A escala interna está reduzida pela
  incorporação na documentação: não é evidência de tamanho tipográfico ou alvo de
  toque real. Aproveitar o agrupamento de dados relacionados e a proximidade entre
  resumo e registros. Não copiar o conjunto de cores por categoria para a auditoria
  operacional do Caderninho.

A [referência para desenvolvimento](design-system.md) transforma esses critérios
em componentes, escala e receitas do próprio Caderninho, sem copiar a identidade.

Esta comparação é pesquisa de produto a partir de páginas oficiais e das três
capturas citadas; não é auditoria dos três aplicativos autenticados. Nenhum fluxo privado de concorrente foi testado.
Não se atribuem a eles cores, fontes, qualidade de contraste ou desempenho que não
tenham sido medidos. A identidade do Caderninho continua sendo Hanken, preto,
superfície neutra e laranja funcional.

## Cinco prioridades de implementação

1. **P1 — Tornar acesso e uso do MCP verificáveis.** Separar conexões bancárias de
   autorizações de clientes. Criar Auditoria MCP com concessões, último acesso,
   volume, chamadas e falhas. O estado de uma concessão não equivale a um cliente
   conectado agora. Modelo desconhecido deve continuar desconhecido.
2. **P2 — Fazer a primeira tela conter trabalho útil.** Reduzir títulos operacionais
   a 28–32 px, corpo a 15 px e espaço de cabeçalho. Retirar eyebrow repetido e a
   frase sobre saldos em Conexões. Filtros comuns ficam em uma linha quando houver
   largura; os adicionais continuam recolhidos. Alvos de interação continuam 44 px.
3. **P2 — Dar significado consistente aos controles.** Um destaque principal por
   tarefa: conectar, aplicar ou confirmar. Importação e atualização são secundários;
   navegação permanece link. Ícone só para ação convencional, com nome acessível,
   dica visível ao foco e ao hover e área de toque completa. Revogar nunca fica
   escondido em ícone ambíguo.
4. **P2 — Mostrar espera sem apagar contexto.** Skeleton apenas na primeira carga,
   com geometria semelhante ao conteúdo. Atualização preserva os registros visíveis
   e anuncia que está atualizando. Falha informa que dados anteriores podem estar
   desatualizados. A mudança de consulta limpa o recorte anterior. Movimento respeita
   `prefers-reduced-motion`; sem animações de valores financeiros.
5. **P2 — Consolidar o vocabulário de componentes.** Cabeçalho, feedback, refresh,
   filtros, estado vazio e skeleton têm uma implementação compartilhada. Tokens e
   escala operacional ficam centralizados. Não criar um sistema genérico de cards,
   temas ou configurações para resolver seis páginas. Conservar componentes de
   domínio para conta, transação e rodada, pois seus significados são diferentes.

## Escala e densidade

| Elemento | Especificação operacional |
| --- | --- |
| Página / seção / registro | Hanken 28–32 / 20 / 17 px; peso 550–600 |
| Corpo / tabela / metadado | 15 / 14 / 12 px; entrelinha de corpo 1,5 |
| Valores | Algarismos tabulares, alinhamento à direita na tabela, moeda explícita |
| Espaços | 8 / 12 / 16 / 24 / 32 px; 16 px dentro de grupos e 24 px entre tarefas |
| Controle | Mínimo 44 px; borda 6 px, superfície 10 px; foco pelo token laranja |

Título grande serve à apresentação pública; não deve ser o padrão de uma tabela.
Reduzir o espaço que não informa permite preservar legibilidade. Não reduzir a
área de toque para aumentar densidade. Não aplicar cor de sucesso apenas porque
uma resposta HTTP ocorreu: identidade, autorização e resultado financeiro são
evidências distintas.

## Proposta de Auditoria MCP

**Pergunta principal: quem teve acesso, o que usou e o que falhou neste período?**

1. **Filtros e resumo.** Período explícito, cliente e resultado; até quatro números:
   chamadas, falhas com percentual, bytes recebidos, bytes enviados. Contadores
   devem declarar se incluem transporte/protocolo e qual é o intervalo disponível.
2. **Clientes e concessões.** Nome declarado e identificação estável, concessão,
   permissões, autorização, último acesso autenticado e revogação individual com
   confirmação. Não chamar nome declarado de identidade verificada; não exibir
   tokens, secrets ou sessão reutilizável.
3. **Atividade.** Série diária compacta de chamadas e falhas, com alternativa
   tabular e total de amostra. Sem gráficos de rosca decorativos. Não acrescentar
   linhas de tendência se um simples total resolver a pergunta.
4. **Modelo informado.** Tabela com nome recebido, origem da declaração, chamadas,
   falhas/denominador, taxa e bytes. Incluir “Não informado”. Isso mede comportamento
   observado no MCP, não qualidade da resposta do modelo, tokens faturados ou custo.
5. **Eventos.** Data, cliente/concessão, método/ferramenta, resultado, duração e
   volume. Detalhes técnicos sob disclosure. O log não deve copiar argumentos,
   extratos, resultados financeiros, prompts ou credenciais para ser útil.

Falhas de transporte, protocolo e ferramenta devem ser distinguíveis. Uma resposta
HTTP 200 pode conter erro MCP. Uma taxa sem denominador induz comparação errada:
mostrar `2 / 40 · 5%`, não apenas `5%`. Bytes medidos no limite do servidor não são
tokens do modelo nem tráfego completo entre usuário e provedor. Limite, retenção,
atraso de gravação ou perda de telemetria precisam ser declarados se existirem.

## Verificação e limites

Esta revisão inspecionou pixels das três telas locais e código de cabeçalhos,
controles, filtros e estados. Capturas estáticas não comprovam teclado, leitor de
tela, estabilidade no carregamento, responsividade ou contraste de todos os estados.
A validação do agente principal deve cobrir celular, foco, filtro, refresh e erro
de rede antes de considerar a implementação concluída. Uma auditoria de produto não
substitui teste de autenticação ou validação de identidade do cliente MCP.

O polimento desta rodada começa pelos itens 2–5. Auditoria MCP é implementada pelo
agente principal a partir do item 1. Novas capturas e resultados dos testes registram
o estado final; este documento conserva o diagnóstico da base para comparação.
