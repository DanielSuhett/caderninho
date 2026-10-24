Status: proposta em draft. O catálogo não é carregado pelo produto.

Catálogo genérico de sugestões de categoria

Escopo
rules.json é um catálogo neutro de dados, sem dependência de banco, provedor,
Securo ou biblioteca de regras. A língua e a taxonomia são pt-BR. Não é um
arquivo de importação Securo/Caderninho; cada consumidor deve adaptar seu
contrato explicitamente. Não inclui regras nem identificadores de instância.

Contrato
1. A entrada tem description original, direction debit/credit, category
   opcional e is_refund opcional. O adaptador identifica a direção pela
   operação do provedor; o catálogo não deduz direção pelo sinal do valor.
2. A normalização NFKD remove marcas combinantes, aplica casefold, converte
   + no termo plus, troca demais caracteres não alfanuméricos por espaço
   e condensa espaços. Ela serve
   somente à comparação. A descrição original não é modificada.
3. any aceita qualquer frase inteira contígua. except rejeita qualquer
   frase inteira contígua. Uma frase não corresponde ao meio de uma palavra.
   Normalizar texto, termos e exclusões com o mesmo procedimento.
4. Não sugerir quando houver categoria não vazia, is_refund verdadeiro,
   direção desconhecida ou termo global skip_any. Aplicar regras privadas
   antes deste catálogo. A primeira regra elegível fornece só uma sugestão
   de categoria. Nunca persistir ou substituir decisões automaticamente.
5. Não havendo correspondência, retornar ausência de sugestão. Pix/TED,
   titularidade, faturas, estornos, investimentos, empréstimos e finalidade
   inferida por valor ou intermediário exigem evidência fora deste catálogo.

Decisões de normalização
Categorias seguem os nomes usados no conjunto de origem. Delivery e doces
ficam em Lanches; KFC fica em Restaurantes; farmácias ficam em Farmácia,
sem inferir que o produto adquirido era medicamento. Esses são padrões
editáveis: o usuário pode substituir qualquer uma dessas escolhas.

Não há regra Amazon genérica, Apple/Google genérica, 99 Pay, operadora por
prefixo curto, posto genérico, assinatura deduzida apenas do nome de SaaS,
transferência própria pelo texto Pix ou receita deduzida de todo crédito.
As exclusões são conservadoras e não cobrem todo produto de cada marca.
Estorno sem marcador ou flag, descritor desconhecido e finalidade incorreta
na descrição não podem ser resolvidos pelo catálogo textual sozinho.

Verificação local
python docs/proposals/category-defaults/validar.py

validar.py é uma referência executável do contrato e uma verificação com
casos sintéticos. Ela não integra o motor de produção e não faz importação,
consulta, gravação, publicação, chamada de rede ou alteração de transação.
