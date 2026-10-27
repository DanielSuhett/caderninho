# Importar regras em JSON

Na tela **Regras**, escolha **Importar regras**, selecione um JSON e confira a
prévia. Resolva nomes de categorias ambíguos, atualize a prévia e confirme.
A lista é atualizada depois da gravação e abre a conferência da reaplicação.
Cancelar/voltar não grava nada no histórico.

O [JSON Brasil](../public/rule-packs/brasil.json) é um arquivo externo de exemplo
(30 regras, 9 categorias, 60 alternativas); também pode ser baixado pelo diálogo.
Nenhum catálogo é importado no bundle ou instalado automaticamente.

O contrato aceita pacotes genéricos com `id`, `version`, `categories` e `rules`.
Categorias declaram `key`, `name`, `kind` (`expense`, `income` ou `transfer`).
Cada regra declara `key`, `categoryKey` e os mesmos campos/filtros nativos de
`create_rule`, sem `categoryId`: a categoria é resolvida no espaço selecionado.
Limites: 100 regras, 50 categorias e arquivo de 64 KiB. JSON malformado, chaves
repetidas, categorias não declaradas e filtros incompatíveis são recusados.

A prévia usa `preview_rule_import` sem escrever. `import_rules` exige confirmação,
revisão da prévia e chave de idempotência; categorias/regras/recibo são gravados
no mesmo batch atômico. Uma revisão concorrente exige atualizar a prévia. Um
resultado de rede incerto pode ser confirmado novamente com a mesma chave.

Nomes iguais de categorias exigem mapeamento explícito. IDs de outro espaço,
categorias ocultas ou de outro tipo são recusados. Categorias ausentes são
criadas; categorias existentes mantêm nome, ícone e grupo. Conta/pessoa em filtros
precisa existir nesta instalação e respeitar o escopo do motor.

IDs de regras derivam de espaço/pacote/chave. Reimportar preserva regras editadas
ou pausadas e não duplica regras idênticas já existentes. Esta versão acrescenta
regras; não substitui versões instaladas. Excluir uma regra permite recriá-la em
uma importação explícita posterior.

Regras pessoais vêm antes das importadas, inclusive quando criadas depois.
Dentro de cada grupo, prioridade menor e depois ID determinam o vencedor.
Defaults preservam categorias editadas localmente, inclusive `null`. Editar uma
regra importada a torna pessoal. Não há aplicação automática ao histórico:
novas importações normais usam o trigger existente; `preview_rule` e `apply_rules`
continuam disponíveis para conferência e reaplicação explícita (até 500 registros).
Excluir/pausar regra não desfaz classificações anteriores.

**Reaplicar regras** fica disponível na tela Regras quando há regras ativas.
Escolha período e, opcionalmente, conta; confira as contagens e uma amostra com
categoria anterior e proposta. Confirmar exige a revisão da prévia e uma chave
de idempotência, com gravação atômica de até 500 transações. Acima desse limite,
reduza o período ou escolha uma conta; a prévia informa o corte e bloqueia a ação.
Dados parciais são identificados. Uma alteração concorrente exige nova prévia;
repetir a confirmação após falha de rede usa o mesmo recibo.

A ação do painel preserva transações ignoradas e categorias alteradas manualmente,
inclusive `null`. Novas classificações por regras guardam `categoryRuleId`, tanto
no trigger da importação como na reaplicação, para permitir uma revisão futura.
Overrides antigos sem origem conhecida são preservados. A demo usa a mesma
política do domínio. O contrato MCP `apply_rules` mantém o comportamento padrão;
os campos opcionais `preserveManual` e `expected_revision` permitem proteção e
concorrência explícitas. A prévia do painel não registra uma nova ferramenta MCP.

A instituição das conexões e a origem das categorias de regra estão no modelo
inicial, `migrations/0001_initial.sql`.

O motor só dobra A–Z; acentos são literais. O Brasil de exemplo exige débito
POSTED/BRL e descrições inteiras declaradas. iFood/Rappi precisam indicar ramo.
Não há inferência por CNPJ/raiz/gateway nem garantia de cobertura bancária;
fontes sustentam atividades, não descritores ou frequência pessoal de compras.

Fontes primárias conferidas em **24/10/2026** sustentam as atividades abaixo,
sem provar frequência pessoal ou formatos de extrato. Antes de ampliar aliases,
confira ramo e colisões na fonte e acrescente casos positivos/negativos ao teste
D1 [rule-packs.test.ts](../tests/integration/rule-packs.test.ts).

| Regras | Fonte de manutenção / razão |
| --- | --- |
| iFood: farmácia, pets, mercado, restaurante | [iFood](https://institucional.ifood.com.br/clientes/ifood-e-mais-que-comida/): vários segmentos; exigir ramo explícito. |
| Rappi: farmácia, pets, mercado, restaurante | [Rappi](https://www.rappi.com.br/): vários segmentos; exigir ramo explícito. |
| Uber viagens / 99Pop | [Uber](https://www.uber.com/br/pt-br/), [99](https://99app.com/passageiro/): separar viagens de entregas e carteira. |
| Netflix / Spotify | [Netflix](https://help.netflix.com/en/node/24926), [Spotify](https://www.spotify.com/legal/paid-subscription-terms): serviços pagos; não afirmar recorrência individual. |
| Petz | [Petz](https://www.petz.com.br/atendimento-inteligente): produtos/serviços pet. |
| Drogasil / Drogaria Raia | [RD Saúde](https://rdsaude.com.br/sobre-a-rd/quem-somos/): varejo farmacêutico; não inferir medicamento. |
| Drogaria São Paulo / Drogarias Pacheco | [DPSP](https://www.drogariasaopaulo.com.br/privacidade/termos-de-uso): farmácias; não inferir item. |
| Assaí / Atacadão / Pão de Açúcar | [Assaí](https://www.assai.com.br/declaracao-de-privacidade), [Atacadão](https://www.atacadao.com.br/institucional/quem-somos), [GPA](https://www.paodeacucar.com/duvidas-frequentes): mercado amplo, não apenas alimentos. |
| McDonald’s / Burger King / KFC | [McDonald’s](https://www.mcdonalds.com.br/quemsomos/privacidade), [BK](https://www.burgerking.com.br/regulamento-clube-bk), [KFC](https://www.kfc.com.br/): restaurantes. |
| Lojas Renner / Lojas Riachuelo / KaBuM / Decathlon | [Renner](https://www.lojasrenner.com.br/privacidade-seguranca), [Riachuelo](https://www.riachuelo.com.br/termos-e-condicoes-de-uso), [KaBuM](https://www.kabum.com.br/sobre), [Decathlon](https://empresas.decathlon.com.br/cadastro): compras amplas; não classificar fatura ou produto específico. |
| Smart Fit / Alura / Udemy | [Smart Fit](https://www.smartfit.com.br/academias), [Alura](https://www.alura.com.br/termos-de-uso), [Udemy](https://www.udemy.com/terms/): academia e educação. |
