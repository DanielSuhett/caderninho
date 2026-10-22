# Landing e acesso privado — revisão local

Revisão em 22/10/2026, branch `codex/landing-access-polish`.

## Resultado e jornadas

- `/` apresenta o MCP, um exemplo financeiro explicitamente fictício e três
  passos: instalar, conectar/importar e autorizar o assistente. Instalar abre o
  botão oficial da Cloudflare; entrar segue para `/account`.
- `/account/login` identifica a instalação, aceita a senha pelo formulário
  nativo e explica a recuperação pelo proprietário. Senha incorreta mantém o
  formulário e apresenta um erro associado ao campo, sem repetir a senha.
- O retorno para `/authorize` muda título, explicação e CTA. O login preserva
  esse retorno, mas não cria uma autorização OAuth.
- Sem `ADMIN_PASSWORD`, o formulário e a recuperação desaparecem. A página
  explica como concluir a configuração e preserva a continuação de autorização
  no link de reabertura.

## Referência e composição

A direção escolhida foi **Dados com origem**, terceira alternativa visual
produzida com Product Design. A implementação reduz a escala, remove ícones
decorativos e nomes técnicos de ferramentas e usa textos compatíveis com o
comportamento real. O exemplo não consulta dados e não simula uma conversa ativa.

`PublicLayout`, `UiLink`, `UiButton` e `UiField` compõem as duas páginas. A fonte
Hanken Grotesk, cores, foco e controles vêm da base existente. A exceção pública
de sombra e movimento está documentada em [design-system.md](design-system.md):
sombra de superfície, entrada única de 400 ms e resposta de hover de 150 ms.
No login, apenas a sombra anima; campos e mensagens permanecem imediatamente
visíveis. `prefers-reduced-motion` desativa animações e transformações.

A revisão da designer não identificou problemas P1/P2 nas capturas finais de
landing desktop/celular e login celular/erro. As capturas demonstram composição
e legibilidade; não constituem medição de contraste ou prova de animação.

## Evidências locais

Capturas sintéticas em `work/design-audit/`, ignoradas pelo Git:

| Evidência | Arquivo |
| --- | --- |
| Login desktop, CTA centralizado | `15-login-desktop.jpg` |
| Login celular | `16-login-mobile.jpg` |
| Erro de senha, campo vazio | `17-login-error.jpg` |
| Landing desktop, viewport 1280 px | `18-landing-desktop.jpg` |
| Landing celular, viewport 392 px | `19-landing-mobile.jpg` |
| Continuação OAuth antes do login | `20-login-oauth.jpg` |

No navegador local em `127.0.0.1:8793`, foram verificados a expansão da
recuperação, senha incorreta, senha correta, painel carregado com dados
sintéticos, saída e a variante de continuação OAuth. A landing móvel apresentou
largura de documento de 376 px em viewport de 392 px, sem rolagem horizontal.

`mise run check` passou: 19 testes Node, 75 testes de integração e a suíte nativa
de Workflow/D1 com 10 mil e 100 mil transações. O cenário de 100 mil registros
terminou em 38.986 ms, com pico workerd de 426.580 KiB neste ambiente. O teste
novo confirma retorno OAuth após erro/sucesso, ausência de autorização criada
pelo login e estado sem configuração sem campo de senha. `check:quick` e
`build:portal` também passaram após o ajuste final de alinhamento.

## Limites da entrega

O site original em `localhost:8787` e as alterações não commitadas em
`/home/suhett/Work/caderninho` foram preservados. A nova landing é gerada em
`dist/web/index.html` pelo build do worktree. O preview usa somente dados e
credenciais sintéticos.

Nenhum push, deploy, merge ou migração remota foi realizado. O botão de instalar
aponta para a versão publicada no GitHub; ele não publica esta branch local.
Não foram validados nesta entrega o primeiro deploy em uma conta Cloudflare
nova, uma conexão Pluggy real ou a autorização em um host MCP externo. O estado
sem senha foi coberto por integração, sem captura de um segundo servidor.
