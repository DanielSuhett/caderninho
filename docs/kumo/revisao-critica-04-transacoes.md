# Revisão crítica 04 — descanso visual em Transações

24/10/2026. Revisão por agente no papel de designer crítica independente.
Complemento à rodada 03 após a correção de critério do usuário: controles
devem corresponder a escolhas reais, e a página deve ser calma. Quantidade de
componentes Kumo e nota anterior não são critérios de aprovação.

**Resultado: 8/10 em Transações privadas e 8/10 em Transações da demo, nos estados
efetivamente vistos nesta rodada.** A composição compacta ficou calma sem
esconder estados ou filtros aplicados. É julgamento qualitativo de agente;
não significa encantamento validado com o usuário, aprovação humana ou nota
para as outras 12 superfícies da rodada anterior.

## 1. Evidência efetivamente aberta

Diretório: `docs/kumo/capturas/rodada-04/`.

| Arquivo | Estado visto | Limite |
| --- | --- | --- |
| `demo-desktop-native.jpg` | Lista da demo em outubro, várias contas/moedas, busca e Filtros | Topo e parte da lista; não contém toda a página |
| `demo-mobile-native.jpg` | Topo e primeiras transações da demo | Não contém rodapé nem lista inteira |
| `demo-filtros-mobile.jpg` | Dialog com Mês e Conta | Não mostra as opções abertas |
| `demo-busca-mobile.jpg` | Busca por mercado, três resultados, Limpar e disclosure | Conteúdo do disclosure não aberto |
| `conta-unica-filtros-mobile.jpg` | Filtros privados sem Conta, Grupo e Pessoa de opção única | Região inferior do formulário exige rolagem; não mostra a lista |

Depois foram abertas `demo-mobile-compacta.jpg`, `conta-unica-mobile.jpg`,
`conta-unica-desktop.jpg`, `demo-busca-compacta-mobile.jpg`,
`demo-busca-320.jpg`, `conta-desconhecida-desktop.jpg` e
`filtro-indisponivel-mobile.jpg`. Essas sete capturas confirmam a composição
compacta e as exceções descritas abaixo. A versão `demo-desktop-native.jpg`
antecede a barra compacta final e permanece evidência histórica dessa evolução.

Por fim foram abertas `varias-contas-mobile.jpg`,
`varias-contas-select-mobile.jpg`, `demo-desktop-final.jpg`,
`demo-mobile-final.jpg`, `grade-transacoes-desktop.jpg` e
`grade-transacoes-mobile.jpg`. Total: 18 imagens inspecionadas, incluindo
versões substituídas documentadas para comparar o ajuste. Os dois arquivos
finais da demo vieram do Worker local sem sessão em 8801; as páginas privadas
vieram de fixture visual sintética em 8799.

Também foram lidos `src/web/demo-transactions.tsx`,
`src/web/account/transactions-view.tsx`, `transaction-list.tsx`,
`filter-fields.tsx`, `workspace-filters.tsx`, `workspace-ui.tsx` e
`src/web/account.css`. A leitura do código sustenta condições de apresentação;
não substitui testar as interações no navegador.

## 2. Ganhos visíveis

1. **A consulta tem um centro claro.** No desktop, busca e Filtros compartilham
   uma barra. O mês aparece junto ao título; sua edição fica no Dialog.
2. **Moeda não ocupa um controle injustificado.** BRL e USD continuam nos valores
   das linhas. Não há convite visual para converter ou somar essas moedas.
3. **As exceções continuam descobertas.** Pendente e Futura permanecem nas linhas,
   com cor usada em estados concretos. A base continua neutra e escura.
4. **O filtro aplicado é recuperável.** A captura de busca mostra o termo,
   contador, Limpar e os três resultados; as notas extensas ficam depois da lista.
5. **O Dialog de demonstração é proporcional.** Tem somente Mês e Conta. O
   privado com catálogo único remove escolhas artificiais de Conta, Grupo e Pessoa.

## 3. Crítica e correções verificadas

**Descanso visual no topo móvel.** Em `demo-mobile-native.jpg`, a primeira
transação começa aproximadamente em y345. Depois do header, há aviso de demo,
título/mês, label de busca, formulário e Filtros em uma segunda faixa. Isso
consome cerca de 286px antes dos dados. É uma inferência de composição a partir
da imagem, não uma medição de usabilidade. A lista está mais calma; o topo ainda
pode ser mais econômico.

**Resolvido visualmente:** `demo-mobile-compacta.jpg` mostra o InputGroup com
botão de busca interno e Filtros na mesma faixa. A primeira linha começa perto
de y265; aparece mais uma transação sem reduzir a tipografia. O executor mediu
y264,84 no DOM em 391px. Isso é posição de composição, não resultado de
usabilidade. O texto longo quebra de modo legível e valores permanecem à direita.

Na busca aplicada em 391px e 320px, a barra permite uma segunda faixa para
Filtros/contador e Limpar; conserva texto, alvos e recuperação. A quebra é
preferível a comprimir esses controles. Não há corte horizontal visível nessas
duas imagens.

**Filtro escondido não pode ficar invisível ao entendimento.** A primeira
leitura do helper de contagem ignorava accountId/person quando os seletores
sumiam. Um valor antigo ou desconhecido ainda restringiria a consulta pelo
hidden. O executor informou a correção para contar esses valores e mostrar
Conta/Pessoa indisponível. `filtro-indisponivel-mobile.jpg` confirma contexto,
contador 2 e Limpar. O executor relatou clique com remoção efetiva dos parâmetros;
esta revisão confirma visualmente a apresentação. A fixture não executa novo
filtro SQL: não é evidência da semântica do backend.

**Conta única confirmada:** a lista privada em desktop e celular mostra o nome
da conta uma vez no contexto, sem coluna repetida, contador ou Limpar redundantes.
Data e valor permanecem alinhados. Na exceção de row fora do catálogo, a coluna
permanece e exibe Conta não identificada, sem insinuar que pertence à conta única.

**Descoberta do aviso parcial resolvida:** em `conta-unica-mobile.jpg` e na versão
desktop, Ver importações parecia texto da frase. `varias-contas-mobile.jpg` e
as duas capturas com grade mostram agora sublinhado discreto. A correção usa
Link nativo, sem acrescentar um botão dominante.

**Escolhas reais confirmadas:** `varias-contas-select-mobile.jpg` mostra o
Select aberto com Conta corrente e Cartão. A conta única havia retirado esse
campo; a multiplicidade o restaura. Menu e rodapé de ações cabem na superfície
móvel, com formulário rolável.

**Grade confirmada na imagem:** os dois overlays mostram a mesma margem externa
para título, barra, Banner e tabela; os conteúdos das linhas têm recuo interno
consistente. Cabeçalhos e células do desktop compartilham alinhamento. No móvel,
descrição/valor e conta/data formam duas faixas legíveis; a tabela não exige
rolagem horizontal no recorte visto. O overlay é apoio de inspeção, não prova
matemática de que todo elemento obedece a uma grade.

| Superfície | Julgamento desta rodada | Motivo |
| --- | --- | --- |
| Transações privadas, desktop e móvel | 8/10 | Barra parcimoniosa; coluna e campos condicionados ao catálogo; parcialidade e recuperação continuam visíveis |
| Transações da demo, desktop e móvel | 8/10 | Mesmo padrão de consulta; mês no contexto; moedas por valor; entrada da lista próxima dos controles |

Não há P1/P2 visual restante nos estados desta rodada. Não atribuo uma nota
maior com base apenas em screenshots: o formulário avançado privado continua
mais longo que o da demo e requer uso real para avaliar esforço, e as imagens
não demonstram a experiência de foco/teclado inteira. A redução de chrome é
comprovada visualmente; satisfação e descoberta exigem observação de uso.

## 4. Condições de preservação

1. A coluna Conta pode sair quando o catálogo completo do escopo comprova uma
   conta e todas as linhas referem essa conta; o nome aparece uma vez no contexto.
2. Conta desconhecida, ausente ou diferente impede apresentar a lista como
   singleton. Não se usa a quantidade de contas na página atual como catálogo.
3. Hidden conserva o contrato GET. Um filtro antigo inválido continua identificável
   e removível, mesmo quando o seletor não representa uma escolha útil.
4. Data e Valor usam papel da célula no CSS responsivo, evitando deslocamento por
   nth-child quando Conta sai. Moeda, parcela e estados continuam legíveis.
5. Contexto de período corresponde ao recorte real. Metadados sob demanda não
   escondem parcialidade, pendências ou consequências financeiras.

## 5. Limites e próxima verificação

Variação visual: baixa, com cor concentrada em estados e ação. Densidade:
moderada na lista e contida na barra principal após o ajuste. Movimento:
não avaliável nestas imagens estáticas. São leituras qualitativas, não medições.

Este complemento não comprova produção, OAuth real, acessibilidade completa ou
dados pessoais reais. O executor informou busca por Enter com GET de mês+texto
e três resultados no Worker local, preservação de accountId ao aplicar e
recuperação por Limpar; não executei essas ações nesta revisão. Os testes
automáticos informados pelo executor não foram usados para atribuir a nota.

Próxima ação de revisão humana: comparar `demo-mobile-native.jpg` com
`demo-mobile-final.jpg` e experimentar uma busca na demo para confirmar se o
descanso visual atende ao usuário.
