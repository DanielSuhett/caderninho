# Navegação sem recarregar o painel — 22/10/2026

## Causa e implementação

Os links internos eram navegações completas de documento. Cada troca desmontava o React, carregava novamente o shell e aguardava `/api/account` antes de exibir a página.

A navegação agora usa History API e uma assinatura React da URL. O shell, a sessão, o cliente API e o polling da instalação permanecem montados; somente a visão correspondente à rota/filtros é substituída. Links continuam sendo anchors reais. Login, destinos externos, fragmentos, downloads, cliques modificados e submissões POST continuam com seu comportamento nativo. Formulários GET de filtros participam da navegação interna. Popstate trata Voltar/Avançar. A mudança fecha drawers, restaura a rolagem e posiciona o foco no conteúdo.

Consultas de leitura têm cache por chave completa, limitado a 20 entradas e 10 segundos, na memória da instância do cliente. Não há localStorage, IndexedDB ou service worker. Atualização manual ignora cache. Operações de escrita invalidam antes e depois da requisição; leituras anteriores à invalidação não repovoam o cache. Falhas de transporte não são armazenadas. Schemas existentes continuam validando respostas.

O skeleton aparece apenas após 150 ms para evitar flashes em consultas rápidas. A primeira visita e consultas após expiração ainda dependem da rede: esta mudança não promete latência zero nem dados previamente carregados para todas as telas.

## Verificação local

- Sequência Regras → Grupos → Regras → Transações → Sincronizações → Visão geral: seis títulos/URLs corretos, foco no conteúdo e nenhuma tela de carregamento da instalação. Logs do Worker: zero novos documentos, scripts ou fontes; um catálogo compartilhado pelas três visões que o consomem. As duas requisições de transações e uma de histórico foram consultas novas esperadas. Polling da instalação continua independente a cada cinco segundos.
- Filtro de regras “Mercado” resultou em uma regra e URL correspondente; Voltar restaurou quatro regras; Avançar restaurou uma. Drawer fechou e liberou body overflow. Navegação pelo drawer móvel para Transações também restaurou foco/rolagem.
- Auditoria e Conexões abertas pela navegação interna. Atualização manual do histórico verificada separadamente após o build final.
- Testes Node cobrem destinos permitidos, separação de consultas, expiração, atualização explícita, limite de entradas, falhas e corrida de invalidação. Artefatos sintéticos e logs em `work/navigation-review/`, ignorados pelo Git.

Nenhuma publicação, migração real, alteração de dados financeiros ou mudança de contrato público. Evidência local não homologa rede de produção, Pluggy, OAuth ou hosts MCP.

`mise run check` passou: tipos, lint, formatação, 23 testes Node (quatro novos), 75 testes de integração, build dry-run e runtime Workflow/D1 com 10 mil e 100 mil transações. A atualização manual do histórico produziu duas respostas 200 distintas: abertura e refresh. O rebuild local reiniciou a sessão de preview durante a verificação; após novo login, a captura final foi conferida sem mensagem de erro.
