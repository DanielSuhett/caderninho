# Auditoria de arquitetura

Base: `origin/main` em `6c2de5c`, após os merges recentes. O checkout principal
contém trabalho local em andamento; esta revisão usa um worktree isolado e não
inclui essas alterações ainda não publicadas.

Método: [improve-codebase-architecture](https://www.aihero.dev/skills-improve-codebase-architecture).
Priorizar módulos alterados recentemente e aplicar o teste de remoção: uma
extração só vale quando concentra conhecimento e reduz o que os consumidores
precisam saber. A implementação faz parte desta entrega, por solicitação do dono.

## Plano publicado antes da implementação

1. **Registrar a base e as evidências.** Executar os checks existentes, mapear
   dependências, revisar histórico, contratos, regras de lint e os caminhos de
   domínio, contratos, Worker e painel. Distinguir defeitos confirmados de
   oportunidades sem impacto demonstrado.
2. **Corrigir contratos e dependências.** Reunir políticas duplicadas, eliminar
   dependências concretas nos casos de uso e fechar lacunas nas restrições
   nativas do Biome. Preservar interfaces públicas do portal e MCP.
3. **Aprofundar os módulos com maior atrito.** Revisar planejamento, importação,
   consultas efetivas e consumo HTTP do painel. Concentrar validação externa,
   seleção, cursores e tratamento de falhas nas respectivas interfaces; remover
   código substituído. Não criar um framework, repository genérico ou container.
4. **Proteger os comportamentos.** Usar testes das interfaces existentes e
   acrescentar regressões para falhas demonstradas. Preservar dinheiro exato,
   moedas, paginação, revisão, idempotência, autenticação, isolamento de pessoas,
   publicação atômica, checkpoints e nomes dos steps duráveis.
5. **Concluir a revisão do diff.** Executar `mise run check:quick` durante as
   mudanças e `mise run check` na entrega, revisar o conjunto novamente e
   atualizar este documento e o draft com achados, correções e evidências.

## Critérios de conclusão

- Nenhum achado confirmado permanece sem correção ou justificativa verificável.
- Tipos, lint e formatação passam sem desativar regras ou adicionar supressões.
- Testes de domínio, integração Cloudflare, build e runtime sintético passam.
- O diff concentra responsabilidades e remove duplicações; tamanho de arquivo
  sozinho não justifica extração.
- O PR permanece draft. Publicação do produto, merge e migrações remotas são
  etapas separadas e não fazem parte desta auditoria.

## Achados e evidências

Levantamento em andamento. Os achados concretos, arquivos e validações serão
registrados nesta seção durante a implementação; este plano não declara que
todos os caminhos já foram revisados.
