# Fluidez React — rodada 06

Rodada 08: [isolamento do Flow, lista de 50 registros, teclado e rede lenta](polimento-08.md).
Evitar render do diagrama não foi convertido em promessa de latência/FPS.

24/10/2026. Base comparada: `adabdb0`, na branch `codex/kumo-refactor`.
Aplicada a skill oficial
[vercel-react-best-practices](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices),
versão declarada 1.0.0, consultada diretamente no repositório da Vercel.
Ela não estava instalada localmente; foram lidos SKILL.md e os critérios
relevantes, sem instalar ferramentas ou dependências no projeto.

## 1. Correções aplicadas

| Critério | Antes | Implementação |
| --- | --- | --- |
| `bundle-barrel-imports` | Entry da landing importava o barrel compartilhado de HTTP/crypto para usar somente tryCatch | Import direto do helper puro em `shared/result`; não traz o cliente HTTP para o entry público |
| `bundle-conditional` | Configuração de conexões e editores participava do boot de qualquer página privada | DashboardView lazy, dentro do Suspense existente; carregado em Conexões ou no estado inicial sem histórico |
| `bundle-preload` | Código da próxima página era solicitado após a ativação | Sidebar antecipa o módulo ao receber foco/hover; nenhuma consulta ou mutação é antecipada |
| `rerender-memo` | Atualização de observedAt renderizava outra vez a página privada com as mesmas props | Fronteira memo nas páginas lazy; snapshot real diferente, estado local, recurso e rota continuam atualizando |
| `rerender-dependencies` | Filtragem da série e safeChartValues criavam arrays novos; options mudava por identidade | Grupos por moeda e valores seguros estabilizados pelas dependências reais, preservando o efeito nativo de Chart |

A demo agora reutiliza a navegação do workspace para páginas, mês, moeda e GET
da busca. URL e histórico continuam sendo a fonte do recorte; busca/detalhes
remontam na mudança de rota. A Sidebar permanece montada, fecha no celular e
o foco vai ao conteúdo. A fronteira entre demo pública e painel privado exige
navegação normal de documento; não há interceptação entre esses dois shells.

As consultas financeiras independentes já usavam Promise.all e continuaram assim.
O cache de leitura mantém os mesmos dez segundos, limite de vinte entradas,
separação por filtros, bypass de atualização e invalidação em escrita. Não foi
adicionado cache de dados, estado financeiro persistente, SWR, React Compiler
ou infraestrutura Next.js. A aplicação continua React 19/Vite/Kumo 2.14.

O motor do gráfico permanece lazy. Seu objeto options agora conserva identidade
quando grupos e moeda não mudam; o efeito de setOption do Kumo depende desse
objeto. Não se usa memo para cálculos triviais de texto ou números. O import
dinâmico de echarts/core foi mantido: Chart recebe o namespace completo tipado e
o lint local proíbe namespace import estático; nenhuma regra foi desabilitada.

## 2. Medições do build

JavaScript em bytes, somando cada arquivo uma vez com suas dependências estáticas.
Os cenários incluem explicitamente os imports dinâmicos obrigatórios indicados
pelos seus nomes. Gzip é a soma dos arquivos comprimidos individualmente; não
representa uma medição de rede, CPU ou FPS. CSS/fontes e features opcionais não
incluídas no cenário ficam fora dessa conta.
[Dados e nomes dos arquivos](performance/bundle-comparison.json).

| Cenário | Antes, bruto / gzip | Depois, bruto / gzip |
| --- | --- | --- |
| Entry inicial da landing, antes do Flow | 35.144 / 12.834 B | 3.059 / 1.737 B |
| Boot privado, account + mount | 893.919 / 282.816 B | 822.906 / 261.304 B |
| Transações privadas, boot + página | 1.001.373 / 319.021 B | 974.891 / 312.876 B |
| Shell demo, demo + demo-view | 873.134 / 281.304 B | 876.723 / 283.959 B |
| Visão geral privada com gráfico/core | 1.517.573 / 496.540 B | 1.491.139 / 490.410 B |

O entry público caiu 91,3% em bytes brutos; isso **não** é redução de 91,3% no
aplicativo completo. O shell da demo cresceu 3.589 B brutos/2.655 B gzip para
eliminar os recarregamentos entre seus recortes. Conexões passa a ter uma carga
lazy no acesso frio; foco/hover na Sidebar antecipa essa carga. Flow e ECharts
continuam com custo próprio, carregados quando usados.

## 3. Evidência no navegador

Build de produção local; dados sintéticos. Antes em 8802 com cópia dos assets de
adabdb0; depois em 8803. A instrumentação só foi servida pela fixture temporária,
fora do código e dos assets entregues. Não captura headers, credenciais ou corpos
financeiros. Registra ferramenta consultada, início/fim de fetch e scripts lidos.
O hook de DevTools conta PerformedWork no componente que produz
`.financial-dashboard`, sem atravessar filhos reutilizados de um bailout.
É contagem delimitada de renderizações, não perfil de duração do React Profiler.

| Verificação | Observação |
| --- | --- |
| Polling com snapshot idêntico | Antes: 23 leituras e 23 renders do dashboard. Depois: 12 leituras e 1 render inicial; nenhum novo render nas 11 leituras seguintes. Ambas fizeram três consultas financeiras iniciais |
| Preload por teclado | Tab até Transações carregou seu chunk antes do clique; as leituras de dados ficaram em quatro antes/depois. O clique abriu a lista |
| Demo | Antes, trocar mês alterou o identificador de boot do documento. Depois, mês, USD, Transações, busca mercado por Enter e dois Voltar mantiveram o mesmo boot |
| Configuração lazy | Ausente no boot da visão geral; apareceu ao abrir Conexões, mantendo o documento. Heading e jornada de conexão foram exibidos |
| Estados interativos | Detalhe de compra parcelada abriu com três parcelas, pendente/futura e moeda; Escape fechou. Busca demo mostrou três resultados e preservou setembro no GET |

As duas janelas de polling têm comprimentos distintos; a relação por leitura é
o resultado comparado, não uma porcentagem de velocidade. As durações dos
fetches locais não são usadas para prometer menor latência de produção.

[Antes](performance/antes-polling.json), [depois](performance/depois-polling.json),
[preload](performance/preload-intent.json) e
[identidade do documento demo](performance/demo-navigation.json).

A demo também foi exercitada no Worker local 8801, sem sessão real, em viewport
CSS 391×845: trocar mês, abrir Sidebar e ir a Transações fechou o menu, removeu
inert do conteúdo e focou workspace-content. Não houve overflow horizontal nesse
estado. [Captura móvel](performance/demo-mobile.jpg) e
[demo desktop](performance/demo-desktop.jpg), ambas no Worker local;
[Transações privadas desktop](performance/transacoes-desktop.jpg) na fixture.
Capturas estáticas não comprovam a fluidez de uma sequência.

## 4. Verificação e limites

`mise run check` passou: tipos, formato, lint, 45 testes Node, 108 testes de
integração em 19 arquivos, build/dry-run e runtime local Workflow/D1 com
10 mil/100 mil registros. A fronteira demo/painel e os recortes GET têm novo
teste de comportamento. `check:quick` passou novamente após estabilizar as
dependências do gráfico e convergir lint/formato. Logs locais em
`/tmp/caderninho-perf-check.log` e `/tmp/caderninho-perf-quick.log`.

Permanece o aviso conhecido de @emotion/is-prop-valid no runner Kumo, sem falha
dos testes. Não houve mudança de dependências, push ou deploy. Dinheiro exato,
moeda, parcialidade, autorização, CSRF e comportamento de escrita foram mantidos.

Não foi medido FPS, INP de campo, CPU sob throttling, dispositivo físico,
OAuth/Pluggy real ou produção. O objetivo verificado foi reduzir código inicial,
eliminar recarregamentos e retirar renders sem dados novos. Não se atribuiu nova
nota visual às páginas. A política de movimento e os limites da preferência do
SO continuam em [motion.md](motion.md).
