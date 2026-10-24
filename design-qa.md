# QA de design: conectar, importar e consultar

final result: passed

23/10/2026 · Product Design / audit + design-qa · parecer independente pré-deploy.

**Nenhum P0/P1/P2 acionável permanece no escopo local auditado.** Os três momentos
implementados preservam a direção aprovada e a identidade atual. Os dois P2
encontrados durante a revisão foram corrigidos e conferidos depois da mudança.
Este resultado aprova o design observado; não certifica Pluggy/OAuth em produção,
leitor de tela ou zoom real de 200%.

## Achados corrigidos e evidência posterior

| Achado da rodada 2 | Correção | Conferência posterior |
| --- | --- | --- |
| P2 — link isolado “Ver histórico de sincronizações” com altura de 19,37 px | Ação em `.journey-details` recebeu `inline-flex` e altura mínima de 44 px, preservando fonte e layout | `mobile-360-history-target-final.json`: altura 44 px, viewport 360 × 800, documento 345 px sem overflow. O link aparece nos detalhes da jornada; não exige uma nova peça visual. |
| P2 — `UPSTREAM_TIMEOUT` orientava conferir perfil/autorização sem evidência de falha nessas configurações | Mensagem específica explica demora do provedor, preservação e próxima elegibilidade; código técnico fica nos detalhes. Causas conhecidas são diferenciadas e o caso desconhecido é neutro | `desktop-timeout-final.jpg` e `mobile-360-timeout-final.jpg`, abertos e comparados com a captura anterior no mesmo input. O texto corrigido não culpa credenciais. `timeout-final-state.json` confirma Workflow `failed`, `UPSTREAM_TIMEOUT` e três registros preservados. |

P3 identificados também foram atendidos: mensagem genérica “Alteração salva.”
retirada do acompanhamento e singular correto em “1 pessoa · 1 conexão”. O aviso
geral de parcialidade que pode aparecer abaixo da jornada é redundância leve de
contexto, sem novo bloqueio de uso; não exige outra rodada de correção.

## Referências e versão avaliada

Fonte visual: `outputs/onboarding-plan-2026-10-23/visuals/conectar-v2.png`,
`importar-v2.png` e `disponivel-v2.png`, aprovadas como direção de hierarquia.
`DESIGN.md`, `docs/design-system.md` e tokens/componentes atuais prevalecem sobre
gradiente, escala e efeitos aproximados do ImageGen.

Implementação: versão de trabalho local do repositório
`/home/suhett/Work/caderninho`, a partir da base `26de722`. As capturas foram feitas
no navegador pelo agente principal e abertas por esta designer. A designer
inspecionou pixels e registros desta rodada, sem operar a sessão do navegador.
O provedor/SDK são simulados explicitamente; Worker, D1 e Workflow são reais no
runtime local. O frontproxy do harness adapta cookies para o navegador de teste;
isso não foi apresentado como alteração ou prova dos cookies de produção.

## Comparações conjuntas e geometria

Os pares fonte/captura desktop foram abertos **juntos no mesmo input visual**,
com rótulos e resolução original. A revisão não foi escrita apenas de memória,
prompts, código ou nomes de arquivo.

| Momento | Fonte × implementação, mesma entrada visual | Resultado |
| --- | --- | --- |
| 1. Conectar | `conectar-v2.png` × `desktop-connect.png` | Um CTA principal; perfil configurado como texto auxiliar; consequência automática antes de autorizar; pessoas/perfis e MCP recolhidos. |
| 2. Acompanhar importação | `importar-v2.png` × `desktop-import-v2.jpg` | Origem, fase atual, observação e parcialidade próximos; CTA disponível só com registros publicados. Sem filtros globais, percentual, ETA ou trilha de cinco fases. |
| 3. Consultar | `disponivel-v2.png` × `desktop-complete.jpg` | Conclusão associada à origem e data, contas/cartões como contexto, leitura prioritária e MCP opcional. O título genérico “Importação concluída” é intencional para retornos. |

Os três mocks e as capturas desktop válidas medem **1487 × 1058 pixels**. O
capturador informou viewport CSS de 1487 × 1058; não houve reamostragem desses
pares. Horários e dados são do cenário sintético e variam legitimamente em
relação ao mock. A captura `desktop-connect.png` tem conteúdo JPEG apesar do
sufixo PNG; isso foi registrado como formato de evidência, não defeito do produto.

No quadro integral em resolução original foi possível examinar cabeçalho,
seletor, CTA, ícones, aviso e metadados com legibilidade. Não foi necessário outro
recorte para esses componentes simples. Medições DOM complementaram a inspeção
dos alvos e foco; screenshot sozinho não comprova essa geometria.

| Mobile/reflow | Viewport e densidade registrados | Raster e avaliação |
| --- | --- | --- |
| 360 | CSS 360 × 800; densidade próxima de 1; documento `clientWidth = scrollWidth = 345` | Exportações de viewport 345 × 766 px. Conectar, Importar, Conclusão, vazio e timeout abertos; nenhuma colisão/corte da UI nas capturas válidas. |
| 390 solicitado | DOM efetivo 391 × 845 por arredondamento; densidade próxima de 1; documento `clientWidth = scrollWidth = 376` | Exportações 376 × 814 px. Três momentos abertos; reflow preserva fase, data, aviso e ações. |
| Reflow equivalente | Pedido 744 × 529, efetivo 744 × 530; documento `clientWidth = scrollWidth = 729` | `reflow-200-equivalent.jpg`, 729 × 518 px. Demonstra layout em metade da largura desktop; **não é zoom real de 200%**. |

A exportação IAB reduz o raster móvel. Essas imagens foram avaliadas como reflow,
sem comparar sua tipografia em pixels com um desktop não normalizado. Não existe
alvo mobile específico: a referência móvel é a adaptação da hierarquia aprovada
ao shell compacto e ao contrato atual.

## Cinco superfícies de fidelidade

| Superfície obrigatória | Avaliação |
| --- | --- |
| Fontes e tipografia | JSON DOM confirma `Hanken, sans-serif` e fonte `loaded`. Títulos, corpo e metadados usam escala operacional menor que o raster, intencionalmente conforme DESIGN.md. Quebras em 360/390 são legíveis; não há truncamento da fase/aviso/CTA nas capturas válidas. |
| Espaço e layout | CTA e status mais próximos do topo que no mock, preservando compactação aprovada. Sidebar, disclosure e agrupamento existentes; alvos não diminuídos para ganhar densidade. Sem nova rota, hero ou wizard. |
| Cores e tokens | Laranja sólido e texto escuro substituem corretamente o gradiente aproximado do raster. Avisos têm contorno uniforme; seleção sem faixa lateral; foco laranja independente. Estado também tem texto e não depende somente de cor. |
| Imagens e ícones | Wordmark tipográfico e família de ícones consistentes. Não houve substituição da interface por screenshot, ilustração improvisada ou novos ativos decorativos. Variações do check do mock mantêm o significado explícito da conclusão. |
| Copy e conteúdo | Configuração, registro, fase, observação, dado publicado, conclusão e falha são fatos distintos. “Conexão registrada” não sugere banco online. A consulta à cópia importada é explicada. Vazio legítimo não pede reconexão; timeout agora tem recuperação compatível. |

Refresh auxiliar no cabeçalho, escala menor, ausência dos ícones ilustrativos do
aviso e título final genérico são diferenças esperadas do uso das peças reais.
Não constituem drift acionável. A marca “Dados de exemplo” do mock não foi
transportada como conteúdo fixo do produto.

## Estados e funcionamento observados

1. **Conectar/importar/consultar:** o agente principal percorreu o clique no botão
   real, abriu o SDK simulado e recebeu o callback. `final-partial-state.json` e
   `final-complete-state.json` registram a mesma execução `660b8876…`: `running`
   com três transações → `succeeded`/finish com nove, uma chamada items e zero sync.
   Foi possível consultar os registros publicados durante a execução. A designer
   verificou as capturas e snapshots, sem atribuir a si o clique do navegador.
2. **Vazio legítimo:** `desktop-empty-complete.jpg`, `mobile-360-empty-complete.jpg`
   e `empty-complete-state.json` mostram `succeeded`, zero transações, uma chamada
   items e zero sync. O catálogo de duas contas permanece distinto dos movimentos;
   autorização não é descartada e não se pede conectar outra vez.
3. **Timeout com parcialidade:** `timeout-final-state.json` registra a execução
   `1934c002…` falha por `UPSTREAM_TIMEOUT`, preservando três registros. O capturador
   informa atraso de 24 s do upstream de teste e retries reais do runtime, sem seed
   do estado final. As capturas corrigidas mantêm o CTA parcial e não mostram sucesso.
4. **Leitura indisponível e recuperação:** `desktop-initial-read-error.jpg` oferece
   Tentar novamente; o capturador relata retorno sem novo login. Na perda posterior
   de status, `read-error-dom.txt` e `mobile-360-read-error-viewport.jpg` mantêm
   conclusão/CTA e explicam que falha de atualização não prova falha da importação.
   `read-recovery.json` registra zero alerts e título “Importação concluída” após
   nova leitura; a exportação de recuperação foi usada apenas como apoio de conteúdo.
5. **Acesso e continuidade:** CTA e summary medem 44 px; o histórico foi remensurado
   em 44 px. O JSON 360 e a captura de conclusão mostram foco laranja no CTA.
   `navigation-keyboard.json` registra Escape fechando o drawer e texto do gatilho
   “Abrir navegação”. Nenhuma navegação automática foi inferida da imagem estática;
   o acompanhamento permaneceu em Conexões no fluxo exercitado pelo capturador.

Console final: agente principal registrou ausência de warn/error antes do 503
injetado. A resposta 503 controlada usada para testar recuperação é esperada e
não foi tratada como erro JavaScript espontâneo. Não houve inspeção independente
do console por esta designer.

## Capturas rejeitadas e esclarecimento do corte

`desktop-import.png` foi rejeitado por resize instável/corte; a referência válida
é `desktop-import-v2.jpg`. `mobile-390-failed-partial.jpg` foi rejeitado porque
contém desktop. `mobile-360-read-error-full.jpg` não foi usado para julgar geometria:
a exportação full parecia cortar o lado direito.

A recaptura válida `mobile-360-read-error-viewport.jpg` e JSON esclarecem o caso:
viewport 360 × 800, documento e body com client/scroll de 345 px; o aviso começa
em x84, tem largura 249,26 e termina em x333,26, dentro do documento. A imagem de
viewport mostra texto/borda/foco íntegros. O aparente corte não foi atribuído ao
produto. Exportações full auxiliares não sustentam alegação de fidelidade geométrica.

## Histórico de comparação e decisão

| Rodada | Achados, correção e evidência |
| --- | --- |
| 1 | Pares Conectar/Importar juntos e quatro mobile abertos, sem P0/P1/P2 nesses estados. Resultado blocked por cobertura ainda incompleta. Preservada em `design-qa-round-1.md`. |
| 2 | Conclusão confrontada com o mock e métricas lidas. Dois P2: alvo 19,37 px e orientação inadequada para timeout. Resultado blocked; `design-qa-round-2.md`. |
| 3 | Alvo corrigido/medido em 44 px, vazio e reflow conferidos. Código de timeout corrigido ainda sem recaptura; corte de exportação móvel a esclarecer. Resultado blocked; `design-qa-round-3.md`. |
| Final | Timeout antes/depois abertos juntos; texto e dados preservados confirmados. Recaptura estável/DOM resolvem a dúvida de corte; recuperação remove aviso. Não restam P0/P1/P2 acionáveis. Resultado passed. |

O QA antigo da raiz foi preservado em `design-qa-before-onboarding.md`; pertencia
a outra entrega e seu resultado não foi reutilizado. Os arquivos desta tabela
ficam em `outputs/onboarding-implementation-2026-10-23/`.

## Verificação complementar e limites

O log `.localdocs/onboarding-live/reviewed-check.log` foi lido: 32 testes Node,
107 testes de integração e um teste de runtime nativo passaram, com cenários de
10 mil/100 mil registros e persistência. Tipos/lint/formato e esses testes são
verificação complementar; não substituem as comparações visuais acima nem provam
desempenho/CPU em produção.

Este parecer não comprova leitor de tela, zoom real de 200%, aparelho físico,
Safari, novo OAuth em host MCP externo ou integração Pluggy real. A auditoria
observa o runtime local com fronteiras sintéticas de provedor/SDK e cookies do
harness adaptados. Ela não testa o 403 do botão Cloudflare nem autoriza concluir
que a instalação pelo botão foi corrigida. Sessão/cookies de produção, consumo
real de CPU e comportamento externo continuam provas separadas.

Nenhuma mudança de produto ou deploy foi executado por esta designer. O resultado
`passed` encerra a revisão de design do escopo local observado antes do deploy.
