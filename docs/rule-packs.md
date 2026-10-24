# Pacote Brasil

O JSON executável está em [brasil.json](../src/contracts/rule-packs/brasil.json):
30 regras compostas, 9 categorias, versão 1. Usa os filtros nativos do produto,
sem normalizador ou classificador paralelo. A instalação é opcional por espaço.

## Instalar e conferir

Chame a ferramenta MCP `install_rule_pack` na instalação escolhida:

```json
{
  "packId": "brasil",
  "spaceId": "personal",
  "confirmed": true,
  "idempotency_key": "instalar-brasil-v1-personal"
}
```

O planejamento valida o comando, resolve categorias de despesa no próprio espaço
e grava categorias, regras, revisão e recibo na mesma transação D1. Reutiliza nome
idêntico, ignorando caixa; cria a categoria quando ausente. Não altera categorias
existentes. Nome duplicado ou categoria oculta exige `categoryIds`, por exemplo
`{"farmacia":"<id-local-retornado-por-get_categories>"}`. IDs de outro espaço,
categorias ocultas e categorias de renda/transferência são recusados.

Confira `get_rules` e `get_categories`. A resposta informa regras criadas/já
existentes e categorias criadas. IDs de regra derivam de espaço, pacote e chave;
repetir a chave devolve o recibo, e outra chave não duplica regras. Reinstalar
preserva regras alteradas ou pausadas; uma regra excluída pode ser recriada pela
próxima instalação explícita. Esta versão não atualiza regras instaladas em lote.

A instalação não toca transações. O trigger existente classifica **novas**
transações nas próximas importações normais do produto. Para o histórico, use a
prévia do editor (correspondências, não vencedor) e `apply_rules` com período,
confirmação e nova chave. O limite continua sendo 500 transações por aplicação.
Não é necessário nem apropriado disparar uma importação para instalar o pacote.

Regras pessoais, inclusive criadas depois da instalação, precedem defaults
independentemente da prioridade numérica. Dentro de cada grupo, menor prioridade
vence; ID desempata. Essa ordem é compartilhada pela aplicação TypeScript, pelo
catálogo e pelo trigger SQL. Defaults não sobrescrevem uma categoria editada
localmente, inclusive `null`. Regras pessoais mantêm a reaplicação explícita já
existente. Editar uma regra do pacote a torna pessoal; pausar preserva a pausa.
Originais bancários permanecem separados de `planning_edits`. Excluir/pausar uma
regra não desfaz categorias já aplicadas; use as edições locais existentes para
corrigir decisões.

## Cobertura e manutenção

Todas as regras exigem débito **POSTED em BRL** e descrição inteira igual a uma
alternativa declarada. São decisões conservadoras sobre o estabelecimento/ramo,
sem inferir item, medicamento, recorrência ou identidade jurídica. iFood/Rappi
exigem ramo explícito (farmácia, pets, mercado ou restaurante); nomes isolados e
conflitos não classificam. Não há regra por CNPJ, raiz, adquirente ou carteira.

A comparação nativa dobra somente A–Z. As variantes acentuadas declaradas estão
no JSON; acentos decompostos, espaços extras, prefixos/sufixos bancários e outras
variantes não são normalizados. Estornos identificados pelo texto e créditos
ficam fora; um débito rotulado apenas com a marca não revela se é reembolso ou
outro evento. Não há taxa medida de precisão/cobertura em produção, ranking de
compras nem descritores bancários comprovados por estas fontes. Os exemplos de
extrato nos testes são sintéticos.

As 82 regras da proposta não foram convertidas cegamente: termos genéricos como
salário, doação, tributos e estacionamento exigem contexto; plataformas e grupos
multiproduto (Carrefour, Cobasi, gateways) são ambíguos; frases normalizadas com
limites de palavra não têm a mesma semântica de `contains` no motor. Foram
preservados apenas padrões expressáveis com segurança no contrato atual.

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
