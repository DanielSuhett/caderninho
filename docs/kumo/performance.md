# Fluidez React

| Decisão | Motivo de manutenção |
| --- | --- |
| Landing importa `shared/result` diretamente | O helper puro não carrega o cliente HTTP no entry público. |
| DashboardView lazy | Configuração de conexões só carrega em Conexões ou na instalação sem histórico. |
| Preload por foco/hover da Sidebar | Antecipa somente módulos; não inicia consultas ou mutações. |
| Páginas lazy com memo | Polling com props idênticas não repete a renderização; dados, estado e rota continuam atualizando. |
| Grupos, valores seguros e options do Chart estáveis | O efeito `setOption` do Kumo depende da identidade do objeto. Não usar memo para cálculos triviais. |

A demo reutiliza a navegação do workspace para páginas, mês, moeda e GET da busca.
URL e histórico são a fonte do recorte; busca/detalhes remontam ao mudar de rota.
A Sidebar permanece montada, fecha no celular e transfere foco ao conteúdo.
A passagem entre demo pública e painel privado exige navegação de documento.

O cache de leitura fica na memória do cliente, com dez segundos e vinte entradas;
filtros compõem a chave, refresh ignora cache e escrita invalida leituras.
Não persistir esse cache financeiro no navegador.

O gráfico carrega sob demanda. O import dinâmico de `echarts/core` fornece o
namespace completo tipado ao Chart; o lint proíbe namespace import estático.
