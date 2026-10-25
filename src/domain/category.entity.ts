import {
  TransactionDirection,
  type TransactionProjection,
} from "./finance.entity";
import {
  type Category,
  type CategoryGroup,
  CategoryKind,
} from "./planning.entity";

export const CategoryIcon = {
  activity: "activity",
  book: "book",
  briefcase: "briefcase",
  car: "car",
  gift: "gift",
  heart: "heart",
  home: "home",
  money: "money",
  shopping: "shopping",
  star: "star",
  transfer: "transfer",
  utensils: "utensils",
} as const;
export type CategoryIcon = (typeof CategoryIcon)[keyof typeof CategoryIcon];

export const fixedCategories = [
  {
    description: "Academias, musculação e atividades físicas",
    group: "bem-estar",
    icon: CategoryIcon.activity,
    key: "academia",
    name: "Academia",
  },
  {
    description: "Aluguel de moradia",
    group: "casa",
    icon: CategoryIcon.home,
    key: "aluguel",
    name: "Aluguel",
  },
  {
    description:
      "Assinaturas de software, streaming, jogos e serviços digitais",
    group: "lazer",
    icon: CategoryIcon.star,
    key: "assinaturas",
    name: "Assinaturas",
  },
  {
    description: "Água, condomínio, móveis, utensílios e despesas da casa",
    group: "casa",
    icon: CategoryIcon.home,
    key: "casa",
    name: "Casa",
  },
  {
    description:
      "Festa, cerimônia e preparativos de casamento explicitamente identificados",
    group: "compromissos",
    icon: CategoryIcon.heart,
    key: "casamento",
    name: "Casamento",
  },
  {
    description: "Gasolina, etanol, diesel e abastecimento de veículos",
    group: "transporte",
    icon: CategoryIcon.car,
    key: "combustivel",
    name: "Combustível",
  },
  {
    description: "Compras de roupas, eletrônicos, brinquedos e outros produtos",
    group: "cotidiano",
    icon: CategoryIcon.shopping,
    key: "compras",
    name: "Compras",
  },
  {
    description: "Táxi, aplicativos de transporte e transporte público",
    group: "transporte",
    icon: CategoryIcon.car,
    key: "corridas",
    name: "Corridas",
  },
  {
    description: "Cabeleireiro, barbearia, beleza, higiene e estética",
    group: "bem-estar",
    icon: CategoryIcon.heart,
    key: "cuidados-pessoais",
    name: "Cuidados Pessoais",
  },
  {
    description: "Cursos livres, online, técnicos e de idiomas",
    group: "educacao",
    icon: CategoryIcon.book,
    key: "cursos",
    name: "Cursos",
  },
  {
    description: "Doações e contribuições beneficentes",
    group: "compromissos",
    icon: CategoryIcon.gift,
    key: "doacoes",
    name: "Doações",
  },
  {
    description:
      "Escola, creche, livros e despesas educacionais sem modalidade específica",
    group: "educacao",
    icon: CategoryIcon.book,
    key: "educacao-geral",
    name: "Educação Geral",
  },
  {
    description: "Conta de energia elétrica",
    group: "casa",
    icon: CategoryIcon.home,
    key: "energia",
    name: "Energia",
  },
  {
    description: "Estacionamento, pedágio e tags de veículos",
    group: "transporte",
    icon: CategoryIcon.car,
    key: "estacionamento-pedagio",
    name: "Estacionamento e Pedágio",
  },
  {
    description: "Graduação, pós-graduação e mensalidades universitárias",
    group: "educacao",
    icon: CategoryIcon.book,
    key: "faculdade",
    name: "Faculdade",
  },
  {
    description: "Medicamentos e compras em farmácias",
    group: "bem-estar",
    icon: CategoryIcon.heart,
    key: "farmacia",
    name: "Farmácia",
  },
  {
    description: "Parcelas de empréstimos e financiamentos, juros de crédito",
    group: "financas",
    icon: CategoryIcon.money,
    key: "financiamento",
    name: "Financiamento",
  },
  {
    description: "Gás de cozinha e gás encanado residencial",
    group: "casa",
    icon: CategoryIcon.home,
    key: "gas",
    name: "Gás",
  },
  {
    description: "Impostos, tarifas bancárias, multas e taxas",
    group: "financas",
    icon: CategoryIcon.money,
    key: "impostos-taxas",
    name: "Impostos e Taxas",
  },
  {
    description: "Internet, telefonia e telecomunicações",
    group: "casa",
    icon: CategoryIcon.home,
    key: "internet",
    name: "Internet",
  },
  {
    description:
      "Aplicações, resgates, previdência e rendimentos de investimentos",
    group: "financas",
    icon: CategoryIcon.money,
    key: "investimentos",
    name: "Investimentos",
  },
  {
    description: "Lanchonetes, cafés, padarias e pequenas refeições",
    group: "alimentacao",
    icon: CategoryIcon.utensils,
    key: "lanches",
    name: "Lanches",
  },
  {
    description: "Lavagem, limpeza e passadoria de roupas",
    group: "cotidiano",
    icon: CategoryIcon.home,
    key: "lavanderia",
    name: "Lavanderia",
  },
  {
    description: "Passeios, cinema, shows, viagens, jogos e entretenimento",
    group: "lazer",
    icon: CategoryIcon.star,
    key: "lazer",
    name: "Lazer",
  },
  {
    description: "Consertos, manutenção de veículos e reparos",
    group: "cotidiano",
    icon: CategoryIcon.home,
    key: "manutencao",
    name: "Manutenção",
  },
  {
    description: "Supermercado, feira, açougue e alimentos para casa",
    group: "alimentacao",
    icon: CategoryIcon.shopping,
    key: "mercado",
    name: "Mercado",
  },
  {
    description: "Dentistas e tratamentos odontológicos",
    group: "bem-estar",
    icon: CategoryIcon.heart,
    key: "odontologia",
    name: "Odontologia",
  },
  {
    description:
      "Ração, produtos para animais, veterinários e cuidados com pets",
    group: "cotidiano",
    icon: CategoryIcon.heart,
    key: "petshop",
    name: "Petshop",
  },
  {
    description: "Restaurantes, refeições e delivery de comida",
    group: "alimentacao",
    icon: CategoryIcon.utensils,
    key: "restaurantes",
    name: "Restaurantes",
  },
  {
    description:
      "Salário, pró-labore, aposentadoria, benefícios e renda do trabalho",
    group: "financas",
    icon: CategoryIcon.briefcase,
    key: "salario-renda",
    name: "Salário e Renda",
  },
  {
    description: "Consultas, exames, hospitais, óticas e serviços de saúde",
    group: "bem-estar",
    icon: CategoryIcon.heart,
    key: "saude-geral",
    name: "Saúde Geral",
  },
  {
    description: "Seguros de vida, saúde, casa e veículos",
    group: "compromissos",
    icon: CategoryIcon.heart,
    key: "seguro",
    name: "Seguro",
  },
  {
    description:
      "Transferências entre contas e pagamento de fatura sem compra identificável; PIX sozinho não identifica finalidade",
    group: "financas",
    icon: CategoryIcon.transfer,
    key: "transferencias",
    name: "Transferências",
  },
] as const;
export type FixedCategoryKey = (typeof fixedCategories)[number]["key"];

export const defaultCategoryGroups = [
  { color: "#64748b", icon: CategoryIcon.home, key: "casa", name: "Casa" },
  {
    color: "#0891b2",
    icon: CategoryIcon.shopping,
    key: "cotidiano",
    name: "Cotidiano",
  },
  {
    color: "#d97706",
    icon: CategoryIcon.utensils,
    key: "alimentacao",
    name: "Alimentação",
  },
  {
    color: "#2563eb",
    icon: CategoryIcon.car,
    key: "transporte",
    name: "Transporte",
  },
  {
    color: "#db2777",
    icon: CategoryIcon.heart,
    key: "bem-estar",
    name: "Saúde e bem-estar",
  },
  {
    color: "#7c3aed",
    icon: CategoryIcon.book,
    key: "educacao",
    name: "Educação",
  },
  { color: "#059669", icon: CategoryIcon.star, key: "lazer", name: "Lazer" },
  {
    color: "#be123c",
    icon: CategoryIcon.gift,
    key: "compromissos",
    name: "Compromissos",
  },
  {
    color: "#475569",
    icon: CategoryIcon.money,
    key: "financas",
    name: "Finanças",
  },
] as const;

export function fixedCategoryId(spaceId: string, key: FixedCategoryKey) {
  return key === "transferencias"
    ? `${spaceId}:transfer`
    : `${spaceId}:fixed:${key}`;
}
function categoryKind(key: FixedCategoryKey): Category["kind"] {
  if (key === "salario-renda") {
    return CategoryKind.income;
  }
  if (key === "transferencias" || key === "investimentos") {
    return CategoryKind.transfer;
  }
  return CategoryKind.expense;
}
export function categoryCatalog(spaceId: string) {
  const categoryGroups = defaultCategoryGroups.map((group) => ({
    color: group.color,
    icon: group.icon,
    id: `${spaceId}:group:${group.key}`,
    name: group.name,
    spaceId,
  }));
  const categories = fixedCategories.map(
    (category) =>
      ({
        color:
          defaultCategoryGroups.find((group) => group.key === category.group)
            ?.color ?? "#64748b",
        groupId: `${spaceId}:group:${category.group}`,
        hidden: false,
        icon: category.icon,
        id: fixedCategoryId(spaceId, category.key),
        kind: categoryKind(category.key),
        limitMinor: null,
        name: category.name,
        spaceId,
        system: true,
      }) satisfies Category,
  );
  return { categories, categoryGroups } satisfies {
    categories: Category[];
    categoryGroups: CategoryGroup[];
  };
}

// All labels in Pluggy's published category tree, plus names used by older categorizers.
// Broad labels deliberately choose the nearest available category, never an invented detail.
export const pluggyCategoryRules: readonly {
  category: FixedCategoryKey;
  labels: readonly string[];
}[] = [
  {
    category: "salario-renda",
    labels: [
      "Income",
      "Salary",
      "Salary/pro-labore",
      "Retirement",
      "Entrepreneurial activities",
      "Government aid",
      "Non-recurring income",
      "Renda",
      "Salário",
    ],
  },
  {
    category: "financiamento",
    labels: [
      "Loans and Financing",
      "Late payment and overdraft costs",
      "Interests charged",
      "Loans",
      "Financing",
      "Real estate financing",
      "Vehicle Financing",
      "Student loan",
    ],
  },
  {
    category: "investimentos",
    labels: [
      "Investments",
      "Automatic investment",
      "Fixed income",
      "Mutual funds",
      "Variable income",
      "Margin",
      "Proceeds interests and dividends",
      "Pension",
    ],
  },
  {
    category: "transferencias",
    labels: [
      "Same person transfer",
      "Same person transfer - Cash",
      "Same person transfer - PIX",
      "Same person transfer - TED",
      "Transfers",
      "Transfer",
      "Transfer - Bank slip (Boleto)",
      "Transfer - Cash",
      "Transfer - Check",
      "Transfer - DOC",
      "Transfer - Foreign exchange",
      "Transfer - Internal",
      "Transfer - PIX",
      "Transfer - TED",
      "Credit card payment",
      "Third-party transfers",
      "Bank slip",
      "Debt card",
      "Debit card",
      "DOC",
      "PIX",
      "TED",
      "Alimony",
      "Blocked balances",
    ],
  },
  {
    category: "internet",
    labels: ["Telecommunications", "Internet", "Mobile", "TV"],
  },
  {
    category: "educacao-geral",
    labels: ["Education", "School", "Kindergarten", "Bookstore"],
  },
  { category: "cursos", labels: ["Online Courses", "Courses"] },
  { category: "faculdade", labels: ["University"] },
  {
    category: "academia",
    labels: [
      "Wellness and fitness",
      "Gyms and fitness centers",
      "Sports practice",
    ],
  },
  { category: "cuidados-pessoais", labels: ["Wellness", "Personal care"] },
  {
    category: "compras",
    labels: [
      "Shopping",
      "Services",
      "Online shopping",
      "Electronics",
      "Clothing",
      "Kids and toys",
      "Sports goods",
      "Office Supplies",
      "Cashback",
      "Other",
    ],
  },
  { category: "petshop", labels: ["Pet supplies and vet"] },
  {
    category: "assinaturas",
    labels: [
      "Digital services",
      "Gaming",
      "Video streaming",
      "Music streaming",
      "Subscriptions",
    ],
  },
  { category: "mercado", labels: ["Groceries"] },
  {
    category: "restaurantes",
    labels: ["Food and drinks", "Eating out", "Food delivery", "Restaurants"],
  },
  { category: "lanches", labels: ["Snacks", "Coffee shops", "Bakeries"] },
  {
    category: "lazer",
    labels: [
      "Tickets",
      "Stadiums and arenas",
      "Landmarks and museums",
      "Cinema, theater and concerts",
      "Travel",
      "Airport and airlines",
      "Accommodation",
      "Accomodation",
      "Mileage programs",
      "Bus tickets",
      "Gambling",
      "Lottery",
      "Online bet",
      "Leisure",
    ],
  },
  { category: "doacoes", labels: ["Donations"] },
  {
    category: "impostos-taxas",
    labels: [
      "Legal obligations",
      "Taxes",
      "Income taxes",
      "Taxes on investments",
      "Tax on financial operations",
      "Bank fees",
      "Account fees",
      "Wire transfer fees and ATM fees",
      "Credit card fees",
      "Urban land and building tax",
      "Vehicle ownership taxes and fees",
      "Traffic tickets",
    ],
  },
  { category: "casa", labels: ["Housing", "Houseware", "Utilities", "Water"] },
  { category: "aluguel", labels: ["Rent"] },
  { category: "energia", labels: ["Electricity"] },
  { category: "gas", labels: ["Gas"] },
  {
    category: "saude-geral",
    labels: ["Healthcare", "Optometry", "Hospital clinics and labs"],
  },
  { category: "odontologia", labels: ["Dentist"] },
  { category: "farmacia", labels: ["Pharmacy"] },
  {
    category: "corridas",
    labels: [
      "Transportation",
      "Taxi and ride-hailing",
      "Public transportation",
      "Car rental",
      "Bicycle",
    ],
  },
  { category: "manutencao", labels: ["Automotive", "Vehicle maintenance"] },
  { category: "combustivel", labels: ["Gas stations"] },
  {
    category: "estacionamento-pedagio",
    labels: [
      "Parking",
      "Tolls and in-vehicle payment",
      "Tolls and in vehicle payment",
    ],
  },
  {
    category: "seguro",
    labels: [
      "Insurance",
      "Life insurance",
      "Home Insurance",
      "Health insurance",
      "Vehicle insurance",
    ],
  },
];
const labelKey = (label: string) =>
  label
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
const providerCategories = new Map(
  pluggyCategoryRules.flatMap((rule) =>
    rule.labels.map((label) => [labelKey(label), rule.category] as const),
  ),
);
for (const category of fixedCategories) {
  providerCategories.set(labelKey(category.name), category.key);
}
export function pluggyCategory(
  category: string | null,
): FixedCategoryKey | null {
  return category ? (providerCategories.get(labelKey(category)) ?? null) : null;
}

export const CLASSIFICATION_VERSION = 1;
export const CLEF_MIN_CONFIDENCE = 0.8;
export interface TransactionClassification {
  category: FixedCategoryKey;
  confidence: number;
  inputHash: string;
  model: "clef-flash";
  version: number;
}
// Identity documents, bank coordinates, balances and identifiers are kept in the
// private ledger. Only evidence of purpose goes to the classifier. CNPJ is not a lookup.
export function classificationState(row: TransactionProjection) {
  const identity = row.identification;
  return {
    counterparty:
      row.direction === TransactionDirection.DEBIT
        ? (identity?.paymentData?.receiver?.name ?? null)
        : (identity?.paymentData?.payer?.name ?? null),
    description: row.description,
    descriptionRaw: identity?.descriptionRaw ?? null,
    direction: row.direction,
    merchant: identity?.merchant
      ? {
          businessName: identity.merchant.businessName,
          category: identity.merchant.category,
          cnae: identity.merchant.cnae,
          name: identity.merchant.name,
        }
      : null,
    operationType: identity?.operationType ?? null,
    operationTypeAdditionalInfo: identity?.operationTypeAdditionalInfo ?? null,
    payeeMCC: identity?.creditCardMetadata?.payeeMCC ?? null,
    paymentMethod: identity?.paymentData?.paymentMethod ?? null,
    reason: identity?.paymentData?.reason ?? null,
  };
}
