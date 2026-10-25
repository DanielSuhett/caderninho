import type {
  ConnectionInfo,
  PortalResponse,
  WorkspaceCatalog,
} from "../contracts";
import {
  AccountType,
  ImportPhase,
  SpaceType,
  TransactionDirection,
} from "../domain";
import { demoCategories, demoCategoryGroups, demoPeople } from "./finance";

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
    origin: "https://demo.example.test",
    people: demoPeople,
    profiles: [],
  });
}
