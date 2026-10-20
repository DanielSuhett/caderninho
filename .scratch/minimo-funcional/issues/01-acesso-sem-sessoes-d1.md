# 01: Acessar o painel e autorizar o MCP sem sessões no D1

**What to build:** O proprietário entra com a senha da instalação, conecta ou reconecta o Meu Pluggy e aprova assistentes MCP sem gravar sessões no banco. A instalação continua privada. Este primeiro lançamento usa banco novo e não precisa de compatibilidade com instalações anteriores.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] O login emite um cookie assinado com validade de oito horas, conferida no servidor. Cookie ausente, adulterado ou expirado não autentica; sem ADMIN_PASSWORD configurada, o acesso privado é recusado. Preservar HttpOnly, Secure, SameSite=Lax, limite nativo de tentativas, origem, CSRF e respostas privadas sem cache. Não adicionar dependência, serviço ou secret manual para substituir a tabela.
- [ ] A emissão de Connect Token, o cadastro de conexão e a aprovação OAuth continuam exigindo o proprietário autenticado. Um token OAuth de assistente não autentica o painel. Tokens de atualização continuam vinculados a conexões cadastradas; credenciais e API Key Pluggy permanecem no servidor. Metadados e registro de clientes OAuth continuam públicos conforme o protocolo, sem conceder acesso financeiro por si mesmos.
- [ ] Sair apaga o cookie do navegador; uma cópia continua válida até a expiração. Trocar a senha ou a versão do Worker invalida todos os cookies anteriores. Não implementar revogação individual nem lista de bloqueio. A autorização OAuth do MCP tem vida independente e sua revogação explícita continua funcionando.
- [ ] A tabela portal_sessions, seu repository e portas exclusivos, a limpeza periódica e os testes exclusivos desse armazenamento deixam de existir. O caminho de autenticação administrativa não acessa D1 nem grava sessões em KV ou outro armazenamento. O KV existente continua sendo usado pelo provedor OAuth.
- [ ] Testes com dados sintéticos demonstram login, expiração, adulteração, troca de senha/versão, logout com a semântica declarada, consentimento OAuth e criação/reconexão do widget. Requisições anônimas ou com apenas credenciais MCP não chegam à Pluggy. Contratos de acesso, documentação e checks ficam coerentes com esse comportamento.
