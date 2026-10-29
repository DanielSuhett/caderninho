import { type Category, CategoryKind } from "./planning.entity";

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
    icon: CategoryIcon.activity,
    key: "academia",
    name: "Academia",
    tone: "bem-estar",
  },
  {
    description: "Aluguel de moradia",
    icon: CategoryIcon.home,
    key: "aluguel",
    name: "Aluguel",
    tone: "casa",
  },
  {
    description:
      "Assinaturas de software, streaming, jogos e serviços digitais",
    icon: CategoryIcon.star,
    key: "assinaturas",
    name: "Assinaturas",
    tone: "lazer",
  },
  {
    description: "Água, condomínio, móveis, utensílios e despesas da casa",
    icon: CategoryIcon.home,
    key: "casa",
    name: "Casa",
    tone: "casa",
  },
  {
    description:
      "Festa, cerimônia e preparativos de casamento explicitamente identificados",
    icon: CategoryIcon.heart,
    key: "casamento",
    name: "Casamento",
    tone: "compromissos",
  },
  {
    description: "Gasolina, etanol, diesel e abastecimento de veículos",
    icon: CategoryIcon.car,
    key: "combustivel",
    name: "Combustível",
    tone: "transporte",
  },
  {
    description: "Compras de roupas, eletrônicos, brinquedos e outros produtos",
    icon: CategoryIcon.shopping,
    key: "compras",
    name: "Compras",
    tone: "cotidiano",
  },
  {
    description: "Táxi, aplicativos de transporte e transporte público",
    icon: CategoryIcon.car,
    key: "corridas",
    name: "Corridas",
    tone: "transporte",
  },
  {
    description: "Cabeleireiro, barbearia, beleza, higiene e estética",
    icon: CategoryIcon.heart,
    key: "cuidados-pessoais",
    name: "Cuidados Pessoais",
    tone: "bem-estar",
  },
  {
    description: "Cursos livres, online, técnicos e de idiomas",
    icon: CategoryIcon.book,
    key: "cursos",
    name: "Cursos",
    tone: "educacao",
  },
  {
    description: "Doações e contribuições beneficentes",
    icon: CategoryIcon.gift,
    key: "doacoes",
    name: "Doações",
    tone: "compromissos",
  },
  {
    description:
      "Escola, creche, livros e despesas educacionais sem modalidade específica",
    icon: CategoryIcon.book,
    key: "educacao-geral",
    name: "Educação Geral",
    tone: "educacao",
  },
  {
    description: "Conta de energia elétrica",
    icon: CategoryIcon.home,
    key: "energia",
    name: "Energia",
    tone: "casa",
  },
  {
    description: "Estacionamento, pedágio e tags de veículos",
    icon: CategoryIcon.car,
    key: "estacionamento-pedagio",
    name: "Estacionamento e Pedágio",
    tone: "transporte",
  },
  {
    description: "Graduação, pós-graduação e mensalidades universitárias",
    icon: CategoryIcon.book,
    key: "faculdade",
    name: "Faculdade",
    tone: "educacao",
  },
  {
    description: "Medicamentos e compras em farmácias",
    icon: CategoryIcon.heart,
    key: "farmacia",
    name: "Farmácia",
    tone: "bem-estar",
  },
  {
    description: "Parcelas de empréstimos e financiamentos, juros de crédito",
    icon: CategoryIcon.money,
    key: "financiamento",
    name: "Financiamento",
    tone: "financas",
  },
  {
    description: "Gás de cozinha e gás encanado residencial",
    icon: CategoryIcon.home,
    key: "gas",
    name: "Gás",
    tone: "casa",
  },
  {
    description: "Impostos, tarifas bancárias, multas e taxas",
    icon: CategoryIcon.money,
    key: "impostos-taxas",
    name: "Impostos e Taxas",
    tone: "financas",
  },
  {
    description: "Internet, telefonia e telecomunicações",
    icon: CategoryIcon.home,
    key: "internet",
    name: "Internet",
    tone: "casa",
  },
  {
    description:
      "Aplicações, resgates, previdência e rendimentos de investimentos",
    icon: CategoryIcon.money,
    key: "investimentos",
    name: "Investimentos",
    tone: "financas",
  },
  {
    description: "Lanchonetes, cafés, padarias e pequenas refeições",
    icon: CategoryIcon.utensils,
    key: "lanches",
    name: "Lanches",
    tone: "alimentacao",
  },
  {
    description: "Lavagem, limpeza e passadoria de roupas",
    icon: CategoryIcon.home,
    key: "lavanderia",
    name: "Lavanderia",
    tone: "cotidiano",
  },
  {
    description: "Passeios, cinema, shows, viagens, jogos e entretenimento",
    icon: CategoryIcon.star,
    key: "lazer",
    name: "Lazer",
    tone: "lazer",
  },
  {
    description: "Consertos, manutenção de veículos e reparos",
    icon: CategoryIcon.home,
    key: "manutencao",
    name: "Manutenção",
    tone: "cotidiano",
  },
  {
    description: "Supermercado, feira, açougue e alimentos para casa",
    icon: CategoryIcon.shopping,
    key: "mercado",
    name: "Mercado",
    tone: "alimentacao",
  },
  {
    description: "Dentistas e tratamentos odontológicos",
    icon: CategoryIcon.heart,
    key: "odontologia",
    name: "Odontologia",
    tone: "bem-estar",
  },
  {
    description:
      "Ração, produtos para animais, veterinários e cuidados com pets",
    icon: CategoryIcon.heart,
    key: "petshop",
    name: "Petshop",
    tone: "cotidiano",
  },
  {
    description: "Restaurantes, refeições e delivery de comida",
    icon: CategoryIcon.utensils,
    key: "restaurantes",
    name: "Restaurantes",
    tone: "alimentacao",
  },
  {
    description:
      "Salário, pró-labore, aposentadoria, benefícios e renda do trabalho",
    icon: CategoryIcon.briefcase,
    key: "salario-renda",
    name: "Salário e Renda",
    tone: "financas",
  },
  {
    description: "Consultas, exames, hospitais, óticas e serviços de saúde",
    icon: CategoryIcon.heart,
    key: "saude-geral",
    name: "Saúde Geral",
    tone: "bem-estar",
  },
  {
    description: "Seguros de vida, saúde, casa e veículos",
    icon: CategoryIcon.heart,
    key: "seguro",
    name: "Seguro",
    tone: "compromissos",
  },
  {
    description:
      "Transferências entre contas e pagamento de fatura sem compra identificável; PIX sozinho não identifica finalidade",
    icon: CategoryIcon.transfer,
    key: "transferencias",
    name: "Transferências",
    tone: "financas",
  },
] as const;
export type FixedCategoryKey = (typeof fixedCategories)[number]["key"];

// Default colors of the classifier catalog, by family of categories.
const categoryTones = {
  alimentacao: "#d97706",
  "bem-estar": "#db2777",
  casa: "#64748b",
  compromissos: "#be123c",
  cotidiano: "#0891b2",
  educacao: "#7c3aed",
  financas: "#475569",
  lazer: "#059669",
  transporte: "#2563eb",
} as const;
// Categories that start as part of the fixed monthly cost.
const defaultFixedCost: ReadonlySet<FixedCategoryKey> = new Set([
  "aluguel",
  "energia",
  "faculdade",
  "farmacia",
  "financiamento",
  "gas",
  "impostos-taxas",
  "internet",
  "mercado",
  "saude-geral",
  "seguro",
]);
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
  const categories = fixedCategories.map(
    (category) =>
      ({
        color: categoryTones[category.tone],
        fixedCost: defaultFixedCost.has(category.key),
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
  return { categories } satisfies { categories: Category[] };
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
