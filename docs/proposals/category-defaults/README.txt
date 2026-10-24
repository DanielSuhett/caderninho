Status: proposta em draft. O catálogo não é carregado pelo produto.

Catálogo genérico de sugestões de categoria

Pacote Brasil — pesquisa em 24/10/2026
82 regras, 16 categorias, proveniência por regra e 47 CNPJs corporativos de
referência. Não é um ranking de frequência de compras. Não usa transações,
contas, valores, identificadores ou correções privadas da instância.

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
   antes deste catálogo. prefer_specific_phrases descarta uma frase genérica
   quando ela está inteiramente contida em outra frase elegível mais específica.
   Se restarem categorias distintas, on_category_conflict=no_suggestion exige
   abstenção. first_match_wins vale entre resultados da mesma categoria.
   Nunca persistir ou substituir decisões automaticamente.
5. Não havendo correspondência, retornar ausência de sugestão. Pix/TED,
   titularidade, faturas, estornos, investimentos, empréstimos e finalidade
   inferida por valor ou intermediário exigem evidência fora deste catálogo.

Decisões e correções
Categorias seguem os nomes usados no conjunto de origem. Delivery e doces
ficam em Lanches; KFC fica em Restaurantes; farmácias ficam em Farmácia,
sem inferir que o produto adquirido era medicamento. Esses são padrões
editáveis: o usuário pode substituir qualquer uma dessas escolhas.

iFood e Rappi isolados deixaram de significar Lanches: as fontes oficiais
mostram farmácia, mercado, pets e outros ramos. IFOOD DROGARIA e RAPPI FARMACIA
sugerem Farmácia pelo ramo explícito. IFOOD RESTAURANTE sugere Lanches pelo
serviço explícito, prevalecendo sobre a palavra genérica RESTAURANTE. A grafia
é exemplo sintético de correspondência, não descritor de banco certificado.

UBER TRIP UBER EATS agora se abstém. UBER TRIP NETFLIX e SUPERMERCADO FARMACIA
também se abstêm por evidências incompatíveis. Spotify Ads, Netflix Shop,
faturas, seguros e intermediários não recebem categoria de compra presumida.
Pague Menos e Cobasi isolados permanecem ambíguos. Mercado é formato do
comércio, sem afirmar a composição da cesta; Compras não presume tipo de item.

Tributos exigem pagamento/cobrança explícitos. Doações exigem finalidade
explícita. Os termos do catálogo são propostas lexicais: sem descritores
observados e revisão humana, os testes não medem acurácia nem cobertura real.

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

Arquivos e proveniência
- rules.json: catálogo neutro e políticas de sugestão na versão 2.
  A versão 2 explicita on_category_conflict e prefer_specific_phrases, além
  dos mesmos campos de regra. Um consumidor da versão 1 precisa adaptar a
  resolução de conflitos; ignorar as políticas novas muda o resultado.
- proveniencia.csv: fonte, data, justificativa e limite para cada regra textual.
- fontes.csv: links e resumo do que cada fonte comprova. Fontes corporativas
  comprovam identidade/serviço, não frequência pessoal nem descritor bancário.
  ABRAS 2026 mede faturamento, usado só para priorizar redes na pesquisa.
- revisao-base.csv: decisão para cada uma das 33 regras da versão anterior.
- cnpjs-referencia.csv: CNPJ completo, entidade, fonte, data e limitações.
  Todas as linhas são referência, sem regra ativa. A coluna verification
  diferencia fontes consultadas nesta execução de pesquisa complementar.
  Os dígitos verificadores são conferidos; isso não certifica situação
  cadastral atual. Não há CPF, sócios, endereços ou empresário individual.
  Importar CNPJ como texto preserva zeros à esquerda; nunca usar a raiz.
  Carrefour mercado e drogaria são filiais distintas da mesma raiz. Raízen/
  Shell Box é facilitador/distribuidora, não um posto varejista identificado.
- exemplos-motor.json: fragmentos de regras compostas no contrato existente,
  com metadados e casos sintéticos. Não são comandos de instalação.

Reaproveitar o motor existente
O produto já possui alternativas OU, condições E, prioridade numérica,
persistência de regras, aplicação em novas importações pelo trigger SQL,
prévia e reaplicação explícita. Edições locais preservam a origem bancária.
Nada disso é recriado por esta proposta. O validador usa o trigger real de
migrations/0006_rule_filters.sql em SQLite exclusivamente em memória para
verificar os exemplos compostos, prioridade e preservação de edição local.

Para aproveitar um exemplo nativo, resolver category para o categoryId real
do espaço e transportar apenas os campos de rule para create_rule. Conferir
as regras privadas existentes e suas prioridades antes de escolher os números;
900 é apenas exemplo, não uma garantia universal de precedência privada.
As gravações/reaplicações seguem confirmação, idempotência e limites já
existentes. Nenhum exemplo foi instalado, aplicado ou enviado ao produto.

Não converter todo o catálogo cegamente em contains: o motor usa substring
e lowercase ASCII, sem NFKD ou fronteiras de frase. Os exemplos respeitam seus
limites de quatro alternativas e oito condições. O exemplo Uber usa equals
para recusar TRIPLEX e descritores mistos, abstendo-se de variantes não listadas.
Uma normalização futura deverá manter paridade nos caminhos SQL e TypeScript.

O filtro atual não possui condição de CNPJ, mesmo que a main já preserve essa
identificação. A tabela de CNPJs não finge integração. O catálogo também não
altera ações de Rule nem cria um motor de substituição: renomear descrição
continua possível pelas mutações locais existentes; salvar uma substituição
recorrente é escopo distinto. Este catálogo não aplica override de nome de
estabelecimento nem deduz categoria de um nome reescrito; respeita a categoria
já definida pelo consumidor.

Uma categoria não vazia bloqueia esta sugestão conservadora, inclusive se vier
do provedor. O produto pode corrigir categorias da origem por regra local;
isso é diferente de autorizar este catálogo público a substituir uma escolha.

Validação e escopo
python3 docs/proposals/category-defaults/validar.py
Os testes são sintéticos, sem rede e sem D1 real. Conferem limites de frases,
direção, estornos, conflitos, categorias existentes, privacidade, proveniência,
CNPJs completos e exemplos compostos contra o trigger existente. A etapa do
mesmo validador foi acrescentada ao CI. Não comprovam precisão em extratos,
integração do catálogo, persistência de substituições ou deploy.
