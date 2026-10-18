# Usar seu Caderninho

## Conectar os bancos

Entre em `/account` com a senha escolhida no deploy. No passo **Conectar bancos**,
abra Meu Pluggy e importe as conexões já cadastradas em [meu.pluggy.ai](https://meu.pluggy.ai/).
O servidor confere a conexão antes de salvá-la; selecionar um banco no widget não
substitui essa validação.

A importação acontece em segundo plano. Pode fechar a página e retornar depois.
Confira cobertura e eventuais falhas antes de usar totais financeiros. Dados
parciais ou antigos continuam identificados; falha não significa saldo zero.

## Conectar o assistente

No passo **Conectar assistente**, copie o endereço do MCP. Adicione um servidor
remoto com OAuth nas configurações de conectores do seu ChatGPT ou Claude. Entre
no Caderninho e confirme a autorização. Não informe sua senha ou credenciais
Pluggy ao assistente.

Copie a primeira pergunta sugerida pelo painel para conferir status e cobertura.
Uma autorização OAuth, por si só, não comprova que o cliente executou uma consulta.
O suporte aos recursos MCP depende do cliente e da versão utilizada.

## Manutenção

- **Sincronização:** a agenda importa diariamente e reconcilia semanalmente. O painel permite solicitar uma cópia manual, com intervalo mínimo de 15 minutos.
- **Pausar:** interrompe próximos agendamentos. Preserva o histórico, as consultas locais e operações já iniciadas.
- **Reconectar bancos:** use Reconectar na manutenção do painel para renovar uma conexão existente.
- **Desconectar assistentes:** revoga todas as autorizações desta instalação. Para voltar a usar um cliente, autorize novamente. Isso não apaga mensagens já enviadas ao serviço de IA.
- **Diagnóstico:** copie o diagnóstico seguro para pedir ajuda. Ele contém estados e contagens, sem credenciais ou dados financeiros.

## Alterar senha ou credenciais

Na sua Cloudflare, abra o Worker em **Settings → Variables and Secrets**. Edite o
secret desejado e publique a alteração. A recuperação da senha troca somente
`ADMIN_PASSWORD`; use de 16 a 256 caracteres. Após uma publicação, entre novamente.

Para atualizar as credenciais Pluggy, altere `PLUGGY_CLIENT_ID` e
`PLUGGY_CLIENT_SECRET` conforme a aplicação escolhida. As chamadas seguintes usam
esses secrets, e o histórico importado continua no D1.

## Dados e backups

O histórico fica no D1 da sua Cloudflare; as credenciais ficam nos secrets do
Worker e não entram no export SQL. O runtime precisa dessas credenciais para
consultar a Pluggy. As respostas MCP são compartilhadas com o assistente autorizado.

Guarde exports D1 em armazenamento privado: eles contêm informações financeiras.
O backup D1 não inclui secrets, autorizações KV nem o estado nativo dos Workflows.
Confira a recuperação em infraestrutura isolada antes de substituir uma instalação.

A [referência técnica](cloudflare-product.md) detalha cobertura, regras, Tasks e recuperação.
