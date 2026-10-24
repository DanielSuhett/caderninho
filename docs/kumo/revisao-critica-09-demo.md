# Revisão crítica 09 — fixtures e demo com editores reais

## 1. Parecer

**A demo de Regras e Transações atinge 8,5/10; Grupos e Visão geral atingem 8/10 nos recortes examinados.** São notas qualitativas de uma revisão por agente, sem equivalência a aprovação humana, teste de usabilidade ou validação de produção. Esta rodada cobre as quatro páginas públicas da demo e os percursos abaixo; não renova a aprovação de todas as páginas privadas.

A separação entre **salvar** e **reaplicar** ficou compreensível. O uso dos editores reais preserva o vocabulário e o comportamento do aplicativo, enquanto a sessão sintética fornece um espaço de experimentação. Foram lidos DESIGN.md, AGENTS.md, a orientação kumo-design já utilizada nesta revisão e as fontes atuais de demo, fixtures, navegação, editores e OrganizationView. A única alteração desta revisora é este relatório.

## 2. Achados corrigidos durante a revisão

| Achado | Consequência | Situação conferida |
| --- | --- | --- |
| Prévia excluía ignorados, mas a primeira versão de reaplicação da demo os incluía. | Uma regra ampla podia mudar lançamentos que a prévia não havia considerado. | A fonte atual exclui ignorados também da reaplicação da demo. O avaliador de condições e a ordenação de regras são compartilhados com o domínio. Essa política específica da demo está explícita; a operação real MCP `apply_rules` conserva seu contrato, que pode incluir ignorados. |
| A ação operava nos seis meses, enquanto a copy podia sugerir o mês corrente; retorno de zero alterações não explicava o resultado. | Ambiguidade sobre alcance e aparente falha de uma operação bem-sucedida. | Copy atual informa **todo o histórico fictício do grupo, exceto ignorados**. Foi visto o retorno **Nenhuma alteração: as 12 correspondências já tinham a categoria**. |
| Regras mostrava **Limpar** apenas por carregar contexto de mês/moeda na URL. | Controle sem filtro efetivo competia com a barra principal. | A decisão de exibir Limpar usa os filtros efetivos. Imagens finais e grades de Regras mostram a barra sem esse botão espúrio. |
| Grupo novo tinha categorias com nomes de enum em inglês e o percurso financeiro não mostrava claramente seu nome. A moeda financeira também estava limitada a BRL/USD. | O visitante perdia orientação e um grupo EUR podia ter contexto monetário incoerente. | Foram vistos **Receitas/Despesas/Transferências**, Casa de exemplo em EUR e o editor preservando EUR. A fonte atual fornece Select de Grupo quando há escolha real ou escopo não pessoal, moeda do grupo e estado vazio explícito. |
| As primeiras capturas finais tinham escala duplicada, faixas pretas ou corte lateral no IAB. | Não sustentavam avaliação de geometria, tipografia ou adaptação móvel. | A leva defeituosa foi rejeitada. Foram reabertos os arquivos nativos corrigidos e as oito grades finais; o PNG não foi redimensionado posteriormente. DPR e pixels físicos não foram usados para inferir tamanho CSS. |

Foi levantada também a diferença entre **grupo válido vazio** e **grupo removido ao recarregar a sessão**. A guarda comum em [Demo](/home/suhett/Work/caderninho/src/web/demo-view.tsx) apresenta **Grupo indisponível nesta sessão**, explica a perda dos grupos experimentais e oferece **Abrir grupo Pessoal**, além de Restaurar demo. A fonte e `grupo-indisponivel.png` nativo foram conferidos: mensagem e recuperação cabem no móvel e distinguem o grupo ausente do estado vazio válido.

## 3. Páginas e estados efetivamente examinados

As imagens estão em [rodada-09](/home/suhett/Work/caderninho/docs/kumo/capturas/rodada-09). Foram abertas as oito imagens `grade-{regras,grupos,transacoes,visao-geral}-{desktop,mobile}.png`, além dos arquivos da tabela.

| Página / percurso | Nota qualitativa | Evidência e leitura |
| --- | --- | --- |
| Regras da demo | **8,5/10** | `regras-desktop-final.png`, `regras-mobile-final.png` e grades atuais: uma ação primária, reaplicação secundária, informação de alcance curta e busca/Filtros sem limpar redundante. O retorno sem alterações diferencia operação concluída de erro. O estado reclassificado mantém síntese curta e prioridade. |
| Editor e descarte de regra | **8/10** | `regra-editor-mobile.png` e `regra-descarte-mobile.png` nativos corrigidos: nome, categoria, prioridade, condição e ações legíveis. O texto **Rascunho preservado** permanece no aviso; continuar/descartar têm consequências distintas, e a ação de salvar fica indisponível no rascunho incompleto mostrado. As imagens não demonstram sozinhas a sequência de foco. |
| Grupos da demo | **8/10** | `grupos-desktop-final.png`, `grupos-mobile-final.png`, `grupo-criado-mobile.png` e grades: Pessoal e Casa de exemplo têm nome/moeda separados, categorias do grupo escolhido e contagem explícita. Os dados de Pessoal não aparecem como lançamentos do novo grupo. A repetição **Sem limite definido** é uma densidade conhecida, sem corte ou perda de significado no recorte. |
| Editor de grupo | **8/10** | `grupo-editor-mobile.png` nativo corrigido mostra Casa de exemplo, dia 15, EUR desabilitado e explicação de que editar não converte valores. As ações cabem na largura móvel. O editor real é compartilhado com o aplicativo. |
| Transações da demo | **8,5/10** | `transacoes-desktop-final.png`, `transacoes-mobile-final.png`, `transacoes-320.png` e grades: ledger uniforme, moeda por valor e contexto de Grupo quando há escolha real. Em 320 px, busca e filtros quebram em duas faixas sem comprimir a leitura do dinheiro. A consulta `mercado` mostra dois débitos reclassificados como Transferência entre contas e o estorno ainda em Mercado. |
| Visão geral da demo | **8/10** | `visao-geral-desktop-final.png`, `visao-geral-mobile-final.png`, grades atuais e comparação funcional inicial: título, controles e superfícies têm eixos coerentes; a mudança de classificação aparece no resumo sem modificar o fluxo bancário. Os arquivos finais após restauração mostram novamente 4.393,81 BRL. Julgamento restrito a composição e continuidade desse percurso, sem nova auditoria da hierarquia financeira nem de todo o conteúdo abaixo da dobra. |

**Leitura qualitativa:** variação visual baixa e monocromia preservada, com cor concentrada em ação/estado; densidade média em listas e maior no editor de condições. A camada de aviso da demo acrescenta contexto necessário para experimentar e reaplicar, mas não virou uma sequência de banners. Movimento não foi objeto de nova medição nesta rodada. Essas avaliações são inferências visuais.

## 4. Semântica, sessão e rascunhos

O primeiro percurso foi aberto em `visao-geral-antes.png`, `salvar-preserva-historico.png`, `regras-reaplicadas.png`, `transacoes-reclassificadas.png` e `visao-geral-reaplicada.png`. Esses arquivos iniciais servem como evidência do encadeamento funcional, não do acabamento final da copy/barra de Regras.

1. Salvar preservou a despesa de **4.393,81 BRL**. Reaplicar informou **12 transações atualizadas** no histórico completo do grupo. A despesa passou a **3.337,20 BRL**, enquanto o fluxo continuou **6.057,89 BRL**. O estorno permaneceu em Mercado porque a regra editada alcançava débitos; o crédito não foi transformado silenciosamente em receita.
2. A sessão usa cópias das fixtures centralizadas em [finance.ts](/home/suhett/Work/caderninho/src/fixtures/finance.ts) e [workspace.ts](/home/suhett/Work/caderninho/src/fixtures/workspace.ts). [createDemoSession](/home/suhett/Work/caderninho/src/web/demo-session.ts) fornece operações locais pela API injetada, sem fetch, storage, bindings de Worker ou credenciais reais nessa implementação. A leitura da fonte sustenta esse isolamento arquitetural; não substitui uma auditoria de segurança ou inspeção completa de tráfego.
3. Salvar muda a definição; reaplicar avalia regras ativas em ordem determinística e preserva categorias sem correspondência. Os agregados derivam do ledger completo, com BigInt e moedas separadas, não da lista de três resultados visíveis. Reset recompõe fixtures e elimina mudanças da sessão. A demo não oferece persistência entre recargas ou abas.
4. [BackofficeDialog](/home/suhett/Work/caderninho/src/web/account/backoffice-dialog.tsx) mantém a proteção de descarte, preserva o campo anterior ao continuar, bloqueia conteúdo inerte no aviso e registra guarda de navegação/beforeunload. O executor relatou Cancelar → Continuar com mesmo nome → Cancelar → Descartar e retorno ao botão Nova regra. Esta revisora viu os estados estáticos, não operou o browser nem produziu uma gravação independente de teclado/foco.
5. O executor relatou criar Casa em EUR, abrir o grupo sem lançamentos pessoais e voltar ao Pessoal, recuperando **17 transações**, inclusive as classificações experimentais. Foram abertos o grupo criado, o editor EUR e a recuperação de grupo removido. `demo-restaurada.png` mostra o resumo com a despesa inicial de **4.393,81 BRL**; o retorno à fixture inicial é coerente com a fonte. O teste local de isolamento entre grupos/sessões complementa esse percurso; não é teste com dados bancários reais.

A diferença de política dos ignorados merece permanecer documentada: a demo foi alinhada à sua prévia para ensinar o percurso mostrado. Isso não permite afirmar que sua ação **Reaplicar regras** reproduz todas as possibilidades, seleções e limites da operação MCP real.

## 5. Cobertura e limites do fechamento

[geometria.json](/home/suhett/Work/caderninho/docs/kumo/capturas/rodada-09/geometria.json) registra as quatro páginas em 1440 × 1000 e 390 × 843 CSS px, corpo 16 px e h1 28 px, com `scrollWidth` igual à largura registrada. A captura adicional de Transações em 320 px foi aberta. Isso apoia a ausência de overflow do documento nesses casos, sem provar cada descendente, cada estado ou acessibilidade completa. A grade foi usada para conferir eixos de conteúdo; o padding próprio do Kumo foi preservado.

| Conjunto | Tratamento nesta revisão |
| --- | --- |
| Oito grades atuais; Regras/Transações finais; Grupos e editores nativos reabertos | Aceitos para composição nos recortes descritos. |
| Seis capturas iniciais do percurso financeiro | Aceitas para sequência de valores/categorias, com copy e controle Limpar anteriores identificados como históricos. |
| Primeira leva com escala/crop; `reaplicadas-*-final`, `salvar-preserva-historico-mobile` e `regra-rascunho-descartado-mobile` enquanto ainda antigos | Rejeitada como prova de geometria. Não reaproveitada para nota móvel. |
| `grupo-isolado-mobile.png` enquanto ainda na escala antiga | Conteúdo legível de nome/estado vazio, sem aprovação geométrica desse arquivo. A disposição final é sustentada pelos recortes nativos da lista e pela fonte; não foi presumida uma recaptura ainda não aberta. |
| `demo-restaurada.png`, `grupo-indisponivel.png` e Overview final desktop/móvel | Abertos após a recaptura nativa final. Restaurar recupera o valor inicial; a guarda oferece recuperação explícita no móvel. O clique de recuperação e toda a sequência de reload continuam apoiados pelo exercício do executor, não por operação independente desta revisora. |

O executor informou que o gate completo passou, incluindo testes Node, integração e runtime sintético. Esta revisora não repetiu a suíte nem tratou seu resultado como aprovação visual. A revisão não valida publicação, OAuth, Pluggy, host MCP, contas reais ou comportamento de produção. Também não afirma uma nova medição de fluidez, contraste completo ou teste integral com leitor de tela.

**Conclusão:** a demo permite experimentar Regras e Grupos com os componentes reais e compreender a diferença entre mudar uma definição e reaplicá-la. Os achados concretos desta revisão foram tratados nas fontes e nos estados aceitos, sem ampliar o parecer aos estados não vistos. As notas não são 10/10 nem aprovação de produção.
