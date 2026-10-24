"""Verifica o catálogo neutro e exemplifica o contrato; somente biblioteca padrão."""

import json
import re
import unicodedata
from pathlib import Path


def normalize(value):
    decomposed = unicodedata.normalize("NFKD", value)
    folded = "".join(c for c in decomposed if not unicodedata.combining(c)).casefold()
    folded = folded.replace("+", " plus ")
    return " ".join("".join(c if c.isalnum() else " " for c in folded).split())


def includes(text, terms):
    return any(f" {normalize(term)} " in f" {text} " for term in terms)


def suggest(catalog, transaction):
    policy = catalog["policy"]
    if transaction.get("category") or transaction.get("is_refund"):
        return None
    direction = str(transaction.get("direction", "")).strip().casefold()
    if direction not in {"debit", "credit"}:
        return None
    text = normalize(transaction["description"])
    if includes(text, policy["skip_any"]):
        return None
    for rule in catalog["rules"]:
        if direction == rule["direction"] and includes(text, rule["any"]):
            if not includes(text, rule.get("except", [])):
                return rule["category"]
    return None


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def main():
    catalog = json.loads(Path(__file__).with_name("rules.json").read_text())
    rules = catalog["rules"]
    ids = [rule["id"] for rule in rules]
    check(len(ids) == len(set(ids)), "IDs duplicados")
    check(catalog["policy"]["only_when_uncategorized"], "Preservar categorias existentes")
    check(catalog["policy"]["preserve_original_description"], "Preservar descrição")
    for rule in rules:
        check(set(rule) <= {"id", "category", "direction", "any", "except"}, rule["id"])
        check(rule["direction"] in {"debit", "credit"}, rule["id"])
        check(bool(rule["category"] and rule["any"]), rule["id"])
        normalized = [normalize(term) for term in rule["any"]]
        check(all(normalized) and len(normalized) == len(set(normalized)), rule["id"])

    cases = [
        ("ALIEXPRESS", "Compras"),
        ("Compra no débito | MercadoLivre", "Compras"),
        ("MERCADO LIVRE", "Compras"),
        ("Mercado Pago", None),
        ("MercadoLivre Mercado Pago", None),
        ("SHOPEE", "Compras"),
        ("Shopee Pay", None),
        ("MAGAZINE LUIZA", "Compras"),
        ("MAGALU PAY", None),
        ("Magazine Luiza financiamento", None),
        ("LOJAS RENNER", "Compras"),
        ("Renner Realize", None),
        ("RIACHUELO MIDWAY", None),
        ("KaBuM!", "Compras"),
        ("O BOTICÁRIO", "Cuidados Pessoais"),
        ("Oboticario", "Cuidados Pessoais"),
        ("BARBEARIA", "Cuidados Pessoais"),
        ("CABELEIREIRO", "Cuidados Pessoais"),
        ("SALAO DE FESTAS", None),
        ("PET SHOP", "Petshop"),
        ("PETZ", "Petshop"),
        ("FARMÁCIA", "Farmácia"),
        ("DROGASIL", "Farmácia"),
        ("SUPERMERCADO", "Mercado"),
        ("ASSAÍ", "Mercado"),
        ("PAGAMENTO FATURA CARREFOUR", None),
        ("BANCO CARREFOUR", None),
        ("CACAU SHOW", "Lanches"),
        ("LINDT", "Lanches"),
        ("PADARIA", "Lanches"),
        ("LANCHONETE", "Lanches"),
        ("KFC", "Restaurantes"),
        ("Uber*Eats", "Lanches"),
        ("UBEREATS", "Lanches"),
        ("UBER TRIP", "Corridas"),
        ("UBER", None),
        ("UBER ONE", None),
        ("UBER TRIP UBER EATS", "Lanches"),
        ("99POP", "Corridas"),
        ("99 Pay", None),
        ("99 Food", "Lanches"),
        ("99Food", "Lanches"),
        ("iFood", "Lanches"),
        ("IFOOD MERCADO", None),
        ("CLUBE IFOOD", None),
        ("RAPPI", "Lanches"),
        ("RAPPI PRIME", None),
        ("RAPPI BANK", None),
        ("NETFLIX", "Assinaturas"),
        ("SPOTIFY", "Assinaturas"),
        ("DISNEY+", "Assinaturas"),
        ("DISNEY PLUS", "Assinaturas"),
        ("DISNEY", None),
        ("YOUTUBE PREMIUM", "Assinaturas"),
        ("YOUTUBE", None),
        ("GOOGLE *ONE", "Assinaturas"),
        ("GOOGLE *APP", None),
        ("APPLE.COM/BILL", None),
        ("Claude.Ai Subscription", "Assinaturas"),
        ("CLOUDFLARE", None),
        ("Ticketmaster", "Lazer"),
        ("Steam Purchase", "Lazer"),
        ("PEDÁGIO", "Estacionamento e Pedágio"),
        ("ESTACIONAMENTO", "Estacionamento e Pedágio"),
        ("PARK", None),
        ("INDIGO", None),
        ("SEM PARAR", None),
        ("SMART FIT", "Academia"),
        ("ACADEMIA DE MUSICA", None),
        ("UDEMY", "Educação Geral"),
        ("ALURA", "Educação Geral"),
        ("IPTU", "Impostos e Taxas"),
        ("IOF", "Impostos e Taxas"),
        ("BIOFLORA", None),
        ("IPVA", "Impostos e Taxas"),
        ("DARF", "Impostos e Taxas"),
        ("IMPOSTO INFORMATIVO", None),
        ("DÍZIMO", "Doações"),
        ("DOAÇÃO", "Doações"),
        ("CARIDADE", None),
        ("PIX RECEBIDO", None),
        ("PIX ENVIADO", None),
        ("TRANSFERENCIA", None),
        ("TED recebida", None),
        ("DIRECT DEPOSIT", None),
        ("FOLHA DE PAPEL", None),
        ("RESGATE CDB", None),
        ("APLICAÇÃO", None),
        ("RENDIMENTOS", None),
        ("Pagamento recebido", None),
        ("DirectDebit", None),
        ("Saque", None),
        ("GLOBAL", None),
        ("POSTO DE SAUDE", None),
        ("ESTORNO ALIEXPRESS", None),
        ("REEMBOLSO FARMACIA", None),
        ("CASHBACK SHOPEE", None),
        ("DEVOLUÇÃO MERCADOLIVRE", None),
        ("NETFLIX REFUND", None),
        ("MEGAPETSHOPPING", None),
        ("ALURANDO", None),
        ("TIMBERLAND", None),
    ]
    total = 0
    for description, expected in cases:
        transaction = {"description": description, "direction": "debit"}
        original = dict(transaction)
        result = suggest(catalog, transaction)
        check(result == expected, f"{description!r}: {result!r} != {expected!r}")
        check(transaction == original, "A transação foi modificada")
        total += 1

    variants = [
        ({"description": "crédito de salário", "direction": "credit"}, "Salário e Renda"),
        ({"description": "crédito de salário", "direction": "debit"}, None),
        ({"description": "DOAÇÃO", "direction": "credit"}, None),
        ({"description": "NETFLIX", "direction": "credit"}, None),
        ({"description": "NETFLIX", "direction": "debit", "category": "Minha escolha"}, None),
        ({"description": "NETFLIX", "direction": "debit", "is_refund": True}, None),
        ({"description": "NETFLIX", "direction": "unknown"}, None),
        ({"description": "NETFLIX"}, None),
        ({"description": "NETFLIX", "direction": " DEBIT "}, "Assinaturas"),
        ({"description": "  FA\u0301RMA\u0301CIA\n", "direction": "debit"}, "Farmácia"),
    ]
    for transaction, expected in variants:
        result = suggest(catalog, transaction)
        check(result == expected, f"{transaction!r}: {result!r} != {expected!r}")
        total += 1

    # Cada termo de cada regra precisa produzir a categoria declarada.
    for rule in rules:
        for term in rule["any"]:
            transaction = {"description": term, "direction": rule["direction"]}
            check(suggest(catalog, transaction) == rule["category"], rule["id"] + ": " + term)
            check(normalize(normalize(term)) == normalize(term), "Normalização não idempotente")
            total += 1

    serialized = json.dumps(catalog, ensure_ascii=False)
    check(not re.search(r"\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b", serialized, re.I), "UUID no catálogo")
    check(not re.search(r"(?<!\d)(?:\d{11}|\d{14})(?!\d)", serialized), "Documento numérico no catálogo")
    print(f"OK: {len(rules)} regras; {total} casos sintéticos; categorias e descrições existentes preservadas.")


if __name__ == "__main__":
    main()
