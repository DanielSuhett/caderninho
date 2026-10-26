import type {
  ConnectionInfo,
  PortalResponse,
  WorkspaceCatalog,
} from "../contracts";
import {
  AccountType,
  ImportPhase,
  RunStatus,
  SpaceType,
  TransactionDirection,
} from "../domain";
import {
  demoAccounts,
  demoCategories,
  demoCategoryGroups,
  demoPeople,
  demoReferenceDay,
} from "./finance";

export function connectionFixture(
  input: Partial<ConnectionInfo> = {},
): ConnectionInfo {
  return {
    accounts: {
      a: {
        balanceMinor: null,
        balanceObservedAt: null,
        currency: "BRL",
        name: "Conta exemplo",
        type: AccountType.BANK,
      },
    },
    hasTransactions: false,
    id: "c",
    importCheckpoint: { accountId: "a", phase: ImportPhase.transactions },
    importError: null,
    importStatus: "running",
    lastSuccessAt: null,
    nextEligibleAt: null,
    partial: true,
    personName: "Pessoa exemplo",
    profileName: "Perfil exemplo",
    ...input,
  };
}
export function portalFixture(
  input: Partial<PortalResponse> = {},
): PortalResponse {
  return {
    configured: true,
    connections: [],
    csrf: "synthetic",
    origin: "https://example.test",
    people: [{ id: "self", name: "Pessoa exemplo" }],
    profiles: [
      {
        configured: input.configured ?? true,
        connectionCount: input.connections?.length ?? 0,
        enabled: true,
        id: "default",
        name: "Perfil exemplo",
        personId: "self",
      },
    ],
    ...input,
  };
}
export function workspaceFixture(): WorkspaceCatalog {
  return {
    categories: structuredClone(demoCategories),
    categoryGroups: structuredClone(demoCategoryGroups),
    rules: [
      {
        accountId: null,
        categoryId: "market",
        direction: TransactionDirection.DEBIT,
        enabled: true,
        filter: null,
        id: "demo-market-rule",
        name: "Compras no mercado",
        priority: 10,
        text: "mercado",
      },
    ],
    spaces: [
      {
        budgetEnabled: true,
        currency: "BRL",
        id: "personal",
        monthlyBudgetMinor: "600000",
        monthStartDay: 1,
        name: "Pessoal",
        type: SpaceType.personal,
      },
    ],
    tags: [{ id: "essential", name: "Essencial" }],
  };
}
export function demoPortalFixture() {
  return portalFixture({
    connections: demoPeople.map((person) =>
      connectionFixture({
        accounts: Object.fromEntries(
          demoAccounts
            .filter((account) => account.personId === person.id)
            .map((account) => [
              account.id,
              {
                balanceMinor: account.balanceMinor,
                balanceObservedAt: account.balanceObservedAt ?? null,
                currency: account.currency,
                ...(account.identity && { identity: account.identity }),
                name: account.name,
                type: account.type,
              },
            ]),
        ),
        hasTransactions: true,
        id: `demo-connection:${person.id}`,
        importCheckpoint: null,
        importStatus: RunStatus.succeeded,
        lastSuccessAt: `${demoReferenceDay}T12:00:00.000Z`,
        partial: false,
        personId: person.id,
        personName: person.name,
        profileId: `demo-profile:${person.id}`,
        profileName: `Meu Pluggy · ${person.name}`,
      }),
    ),
    origin: "https://demo.example.test",
    people: structuredClone(demoPeople),
    profiles: demoPeople.map((person) => ({
      configured: true,
      connectionCount: 1,
      enabled: true,
      id: `demo-profile:${person.id}`,
      name: `Meu Pluggy · ${person.name}`,
      personId: person.id,
    })),
  });
}
