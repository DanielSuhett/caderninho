# Revisão visual e funcional: painel e auditoria MCP

22/10/2026 · branch `codex/mcp-audit-polish`, a partir de `8e7fc7e`.
Product Design / audit aplicado com uma agente designer crítica. Referências
públicas e limites da comparação estão em [design-critical-review.md](design-critical-review.md).
O contrato para desenvolvimento está em [design-system.md](design-system.md).

## Resultado observado

| Verificação | Evidência |
| --- | --- |
| Densidade de Transações | Capturas antes/depois abertas juntas, viewport solicitada 1280×900. Primeiro registro passou de aproximadamente 695 para 472 px: três registros completos em vez de um. Titular, conta, categoria e moeda preservados. |
| Hierarquia | Título 28–32 px, corpo 15, tabela/controle 14, metadado 12. Cabeçalho, filtros, métricas, ícone de atualização e skeleton são componentes compartilhados. |
| Teclado | Tab alcançou atualização com `aria-label`, foco visível e alvo medido de 44 px. A designer identificou duas dicas sobrepostas; o `title` nativo foi removido, mantendo a dica CSS e nome acessível. |
| Referência viva | `/account/design-system` renderiza peças reais, paleta, fonte local, escala, layout de leitura, skeleton, vazio, atualização, erro e confirmação de exemplo. Botões demonstrativos produzem feedback. |
| Isolamento do exemplo | Selecionar grupo/pessoa fictícios gerou `demoSpace`/`demoPerson`; link Transações permaneceu `/account/transactions`, sem contaminar o escopo financeiro. |
| Celular | Galeria e auditoria com viewport efetiva 391 px, documento 376 px (barra de rolagem descontada), sem overflow horizontal da página. Links de período: 44 px de altura e fonte de 14 px. Tabelas de auditoria têm rolagem interna. |
| Skeleton | Disclosure na galeria expôs estado anunciado “Carregando dados salvos…”. CSS define `prefers-reduced-motion` sem animação; a preferência do sistema não foi alterada para este teste. |
| OAuth local e MCP | Dois clientes sintéticos autorizados pelo fluxo real local; 12 chamadas, duas falhas em HTTP 200. Modelo sintético declarado e grupo “Não informado” apareceram separadamente, com denominador e volume. |
| Revogação | Cancelar conservou as duas autorizações. Confirmar revogação da A deixou somente B e preservou 12 eventos. Integração também prova token revogado 401 e outro token 200. |
| Erro de sessão | Uma recarga do preview invalidou a sessão durante a revisão; a tela manteve dados antigos com aviso e não afirmou sucesso da revogação. Após login, a operação foi confirmada. |

## Capturas locais

Arquivos em `work/design-audit/`, ignorados pelo Git. São dados sintéticos.

- `01-transactions-before.jpg` e `04-transactions-after.jpg`: comparação principal.
- `07-audit-revoked.jpg`: confirmação de revogação; anterior ao ajuste cosmético da barra de atividade para neutro.
- `08-design-system-desktop.jpg`: fundamentos do kit visual.
- `10-gallery-mobile.jpg` e `11-gallery-states-mobile.jpg`: galeria e skeleton em viewport móvel efetiva.
- `12-audit-mobile.jpg`: auditoria móvel, métricas e períodos.

A primeira tentativa de screenshot móvel manteve 1280 px. Ela foi descartada e
substituída após renovar o handle da capacidade de viewport; o relatório usa a
largura efetivamente lida, não apenas o pedido ao navegador. Builds sucessivos
causaram manifesto de assets antigo no preview Wrangler; reiniciar o servidor
local resolveu o 404 de chunk. Isso não exigiu alteração no código de produção.

## Testes e limites

`mise run check` concluiu: configuração, tipos gerados, TypeScript, formato, lint,
19 testes Node, 74 testes de integração, build/dry-run e Worker/D1/Workflow local
com 10 mil e 100 mil transações. O cenário de 100 mil levou 36,4 s nesta execução,
com pico reportado de 422032 KiB no workerd. Esse número não é benchmark da UI.
Após ajustes de galeria/tipografia/tooltip, `check:quick` e build foram repetidos.

O build mantém avisos de diretivas `use client` de dependências, sem falha.
A revisão não comprova leitor de tela, zoom real de 200%, todos os contrastes ou
animação com emulação do sistema. Não houve publicação, migração remota, dados
bancários reais ou OAuth em um host MCP externo. Bytes, modelo declarado,
retenção e lacunas possíveis estão descritos em [mcp-audit.md](mcp-audit.md).
