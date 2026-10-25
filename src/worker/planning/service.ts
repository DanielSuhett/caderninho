import type {
  PlanningCommand,
  PortalCardsQuery,
  PortalTransactionQuery,
} from "../../contracts";
import { planningDefinitions } from "../../contracts";
import { hash, tryCatch } from "../../shared";
import { portalCards } from "./cards.service";
import type { PlanningRepository, PlanningSnapshot } from "./entity";
import { planningMutation } from "./mutations.service";
import { portalTransactions } from "./portal-transactions.service";
import {
  accounts,
  planningCoverage,
  planningSelection,
  type Selection,
} from "./projection";
import { planningQuery } from "./queries.service";
import { previewRule } from "./rule-preview.service";

const reads = new Set<string>(
  planningDefinitions.filter((d) => d.readOnly).map((d) => d.name),
);
function readContext(snapshot: PlanningSnapshot, selection: Selection) {
  const coverage = planningCoverage(snapshot, selection);
  return {
    coverage,
    oldestLastSuccessAt: coverage.oldestLastSuccessAt,
    partial: coverage.partial,
    revision: snapshot.revision,
    scope: {
      spaceId: selection.spaceId,
      ...(selection.personId && { personId: selection.personId }),
    },
    view: "effective",
  };
}
function readSelection(snapshot: PlanningSnapshot, input: PlanningCommand) {
  const selection = planningSelection(input);
  if (input.tool === "get_card_commitments") {
    selection.accountIds = accounts(snapshot)
      .filter((account) => account.type === "CREDIT")
      .map((account) => account.id);
  }
  return selection;
}
export function createPlanningService(
  repository: PlanningRepository,
  now: () => Date = () => new Date(),
) {
  async function receipt(key: string, digest: string) {
    const prior = await repository.receipt(key);
    if (prior && prior.digest !== digest) {
      throw new Error("IDEMPOTENCY_CONFLICT");
    }
    return prior;
  }
  async function recover(input: {
    key: string;
    digest: string;
    revision: number;
    error: Error;
  }) {
    const prior = await receipt(input.key, input.digest);
    if (prior) {
      return prior.result;
    }
    if ((await repository.revision()) !== input.revision) {
      throw new Error("RESTART_REQUIRED");
    }
    throw input.error;
  }
  async function purchases(input: PortalTransactionQuery) {
    const snapshot = await repository.read();
    const context = readContext(snapshot, input);
    snapshot.partial = context.partial;
    const result = await portalTransactions(input, snapshot, repository, now());
    if ((await repository.revision()) !== snapshot.revision) {
      throw new Error("RESTART_REQUIRED");
    }
    return {
      ...context,
      data: result,
    };
  }
  function query(input: PlanningCommand, snapshot: PlanningSnapshot) {
    if (input.tool === "preview_rule_import") {
      return planningMutation(input, {
        now: now().toISOString(),
        repository,
        snapshot,
        state: structuredClone(snapshot.state),
      });
    }
    return planningQuery(input, snapshot, repository, now());
  }
  return {
    async cards(input: PortalCardsQuery) {
      const snapshot = await repository.read();
      const data = await portalCards(input, snapshot, repository, now());
      const context = readContext(snapshot, {
        ...input,
        accountIds: data.accounts
          .filter(
            (account) => !input.accountId || account.id === input.accountId,
          )
          .map((account) => account.id),
      });
      if ((await repository.revision()) !== snapshot.revision) {
        throw new Error("RESTART_REQUIRED");
      }
      return { ...context, data };
    },
    async execute(input: PlanningCommand): Promise<unknown> {
      if (input.tool === "preview_rule") {
        const result = await previewRule(repository, input);
        return {
          data: result,
          partial: result.partial,
          revision: result.revision,
        };
      }
      if (input.tool === "get_transaction_purchases") {
        return purchases({ ...input, tool: "get_portal_transactions" });
      }
      const digest = await hash(input);
      if ("idempotency_key" in input) {
        const prior = await receipt(input.idempotency_key, digest);
        if (prior) {
          return prior.result;
        }
      }
      const snapshot = await repository.read(
        reads.has(input.tool) ? input.tool : undefined,
      );
      if (reads.has(input.tool)) {
        const context = readContext(snapshot, readSelection(snapshot, input));
        snapshot.partial = context.partial;
        const result = await query(input, snapshot);
        if ((await repository.revision()) !== snapshot.revision) {
          throw new Error("RESTART_REQUIRED");
        }
        return { ...context, data: result };
      }
      if (!("idempotency_key" in input)) {
        throw new Error("CONFIRMATION_REQUIRED");
      }
      const state = structuredClone(snapshot.state);
      const result = await planningMutation(input, {
        now: now().toISOString(),
        repository,
        snapshot,
        state,
      });
      const { data: _data, error } = await tryCatch(() =>
        repository.commit({
          before: snapshot,
          digest,
          key: input.idempotency_key,
          now: now().toISOString(),
          result,
          state,
        }),
      );
      if (error) {
        return recover({
          digest,
          error,
          key: input.idempotency_key,
          revision: snapshot.revision,
        });
      }
      return result;
    },
    portalTransactions: purchases,
  };
}
