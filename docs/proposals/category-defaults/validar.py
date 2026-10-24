"""Verifica o catálogo neutro e exemplifica o contrato; somente biblioteca padrão."""

import json
import re
import csv
import sqlite3
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
    matches = [
        (rule["category"], normalize(term))
        for rule in catalog["rules"]
        if direction == rule["direction"] and not includes(text, rule.get("except", []))
        for term in rule["any"]
        if includes(text, [term])
    ]
    if policy.get("prefer_specific_phrases"):
        matches = [
            match for match in matches
            if not any(match[1] != other[1] and includes(other[1], [match[1]]) for other in matches)
        ]
    if policy.get("on_category_conflict") == "no_suggestion" and len({match[0] for match in matches}) > 1:
        return None
    return matches[0][0] if matches else None


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
        ("Uber*Eats", None),
        ("UBEREATS", None),
        ("UBER TRIP", "Corridas"),
        ("UBER", None),
        ("UBER ONE", None),
        ("UBER TRIP UBER EATS", None),
        ("99POP", "Corridas"),
        ("99 Pay", None),
        ("99 Food", None),
        ("99Food", None),
        ("iFood", None),
        ("IFOOD MERCADO", None),
        ("CLUBE IFOOD", None),
        ("RAPPI", None),
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
        ("IPTU", None),
        ("IOF", None),
        ("BIOFLORA", None),
        ("IPVA", None),
        ("DARF", None),
        ("IMPOSTO INFORMATIVO", None),
        ("DÍZIMO", None),
        ("DOAÇÃO", None),
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
        ("RAPPI FARMACIA", "Farmácia"),
        ("IFOOD DROGARIA", "Farmácia"),
        ("IFOOD PET SHOP", "Petshop"),
        ("RAPPI PETZ", "Petshop"),
        ("IFOOD RESTAURANTE", "Lanches"),
        ("RAPPI RESTAURANTES", "Lanches"),
        ("SUPERMERCADO FARMACIA", None),
        ("UBER TRIP NETFLIX", None),
        ("NETFLIX PETZ", None),
        ("CARREFOUR", None),
        ("CARREFOUR DROGARIA", "Farmácia"),
        ("PAGUE MENOS", None),
        ("FARMACIAS PAGUE MENOS", "Farmácia"),
        ("SUPERMERCADO PAGUE MENOS", "Mercado"),
        ("FARMACIA VETERINARIA", None),
        ("COBASI", None),
        ("COBASI PISCINA", None),
        ("COBASI PET SHOP", "Petshop"),
        ("ELETRO MATEUS", "Compras"),
        ("SPOTIFY ADS", None),
        ("NETFLIX SHOP", None),
        ("PAGSEGURO NETFLIX", None),
        ("SHELL BOX", None),
        ("GOOGLE *APP", None),
        ("PAGAMENTO IPVA", "Impostos e Taxas"),
        ("SIMULACAO PAGAMENTO IPVA", None),
        ("PAGAMENTO DE DOACAO", "Doações"),
        ("SUBWAY LANCHONETE", "Restaurantes"),
        ("05.570.714/0001-59", None),
        ("CLIENTE CNPJ 05.570.714/0001-59", None),
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
        ({"description": "IFOOD DROGARIA", "direction": "debit", "category": "Categoria da regra privada"}, None),
        ({"description": "NETFLIX", "direction": "debit", "category": "Petshop"}, None),
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
    total += verify_native_examples()
    verify_provenance(rules)
    print(f"OK: {len(rules)} regras; {total} casos sintéticos; categorias e descrições existentes preservadas; fontes/CNPJs e exemplos compostos verificados.")


def verify_native_examples():
    """Exercita dados de exemplo contra o trigger real, somente SQLite em memória."""
    root = Path(__file__).parent
    examples = json.loads((root / "exemplos-motor.json").read_text())["examples"]
    database = sqlite3.connect(":memory:")
    database.executescript("""
        CREATE TABLE transactions(id TEXT PRIMARY KEY,account_id TEXT,date TEXT,amount_minor TEXT,currency TEXT,direction TEXT,status TEXT,description TEXT,category TEXT);
        CREATE TABLE planning_rules(id TEXT PRIMARY KEY,data TEXT);
        CREATE TABLE planning_edits(id TEXT PRIMARY KEY,data TEXT);
        CREATE TABLE planning_accounts(id TEXT PRIMARY KEY,data TEXT);
        CREATE TABLE connections(id TEXT PRIMARY KEY,accounts TEXT);
        CREATE TABLE connection_owners(connection_id TEXT,person_id TEXT);
        CREATE TRIGGER planning_apply_new_transaction_rules AFTER INSERT ON transactions BEGIN SELECT 1; END;
    """)
    database.executescript((root.parents[2] / "migrations/0006_rule_filters.sql").read_text())
    total = 0
    for example in examples:
        database.execute("DELETE FROM planning_rules")
        rule = {**example["rule"], "id": example["id"], "spaceId": "personal", "enabled": True, "categoryId": "synthetic-category"}
        check(len(rule["filter"]["alternatives"]) <= 4, "Limite de alternativas do motor")
        check(all(len(a["conditions"]) <= 8 for a in rule["filter"]["alternatives"]), "Limite de condições do motor")
        database.execute("INSERT INTO planning_rules VALUES(?,?)", (rule["id"], json.dumps(rule)))
        for item in example["cases"]:
            ident = f"synthetic-{total}"
            database.execute("INSERT INTO transactions VALUES(?,?,?,?,?,?,?,?,?)", (ident,"synthetic-account","2026-10-24","-100","BRL",item.get("direction", "DEBIT"),"POSTED",item["description"],"provider-category"))
            edit = database.execute("SELECT data FROM planning_edits WHERE id=?", (ident,)).fetchone()
            check(bool(edit) == item["matches"], example["id"] + ": " + item["description"])
            check(database.execute("SELECT category FROM transactions WHERE id=?", (ident,)).fetchone()[0] == "provider-category", "Origem bancária alterada")
            total += 1
    # Regra privada com prioridade explícita vence a proposta compartilhada.
    shared = {**rule, "id": "shared", "text": "synthetic", "filter": None, "priority": 900}
    private = {**shared, "id": "private", "categoryId": "private-category", "priority": 10}
    database.execute("DELETE FROM planning_rules")
    for candidate in [shared, private]:
        database.execute("INSERT INTO planning_rules VALUES(?,?)", (candidate["id"], json.dumps(candidate)))
    database.execute("INSERT INTO transactions VALUES('priority','synthetic-account','2026-10-24','-100','BRL','DEBIT','POSTED','synthetic','provider-category')")
    check(json.loads(database.execute("SELECT data FROM planning_edits WHERE id='priority'").fetchone()[0])["category"] == "private-category", "Precedência privada")
    database.execute("INSERT INTO planning_edits VALUES('preserved',?)", (json.dumps({"id":"preserved","category":"user-category"}),))
    database.execute("INSERT INTO transactions VALUES('preserved','synthetic-account','2026-10-24','-100','BRL','DEBIT','POSTED','synthetic','provider-category')")
    database.execute("UPDATE transactions SET description='provider update' WHERE id='preserved'")
    check(json.loads(database.execute("SELECT data FROM planning_edits WHERE id='preserved'").fetchone()[0])["category"] == "user-category", "Edição local deve sobreviver à origem")
    database.close()
    return total + 2


def verify_provenance(rules):
    root = Path(__file__).parent
    def rows(name):
        with (root / name).open(encoding="utf-8-sig", newline="") as stream:
            return list(csv.DictReader(stream))
    sources = {row["source_id"] for row in rows("fontes.csv")}
    provenance = rows("proveniencia.csv")
    check({row["rule_id"] for row in provenance} == {r["id"] for r in rules}, "Proveniência de cada regra")
    check(all(set(row["source_ids"].split(";")) <= sources for row in provenance), "Fonte de regra ausente")
    documents = rows("cnpjs-referencia.csv")
    check(len({row["cnpj"] for row in documents}) == len(documents), "CNPJ repetido")
    for row in documents:
        cnpj = row["cnpj"]
        check(bool(re.fullmatch(r"[0-9]{14}", cnpj)) and len(set(cnpj)) > 1, "CNPJ completo")
        for length, weights in [(12,[5,4,3,2,9,8,7,6,5,4,3,2]), (13,[6,5,4,3,2,9,8,7,6,5,4,3,2])]:
            remainder = sum(int(digit)*weight for digit,weight in zip(cnpj[:length],weights)) % 11
            check(int(cnpj[length]) == (0 if remainder < 2 else 11-remainder), "Dígito de CNPJ inválido")
        check(row["source_id"] in sources and row["status"] == "reference_only_no_active_rule", "CNPJ só pode ser referência documentada")


if __name__ == "__main__":
    main()
