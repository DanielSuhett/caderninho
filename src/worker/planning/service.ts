import type {
  PlanningCommand,
  PlanningQuery,
  PortalTransactionQuery,
} from "../../contracts";
import { isPlanningQuery } from "../../contracts";
import { PlanningError } from "../../domain";
import { hash, tryCatch } from "../../shared";
import type {
  PlanningRead,
  PlanningRepository,
  PlanningResult,
  PlanningSnapshot,
} from "./entity";
import { planningMutation } from "./mutations.service";
import { portalTransactions } from "./portal-transactions.service";
import {
  planningCoverage,
  planningSelection,
  type Selection,
} from "./projection";
import { planningQuery } from "./queries.service";
import { previewRule } from "./rule-preview.service";

const catalogReads = new Map<PlanningQuery["tool"], PlanningRead>([
  ["get_tags", "tags"],
  ["get_rules", "rules"],
  ["get_categories", "categories"],
  ["get_category_groups", "categoryGroups"],
  ["get_spaces", "spaces"],
  ["get_notification_preferences", "notifications"],
]);
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
export function createPlanningService(
  repository: PlanningRepository,
  now: () => Date = () => new Date(),
) {
  async function receipt(key: string, digest: string) {
    const prior = await repository.receipt(key);
    if (prior && prior.digest !== digest) {
      throw new Error(PlanningError.IDEMPOTENCY_CONFLICT);
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
      throw new Error(PlanningError.RESTART_REQUIRED);
    }
    throw input.error;
  }
  async function purchases(input: PortalTransactionQuery) {
    const snapshot = await repository.read();
    const context = readContext(snapshot, input);
    snapshot.partial = context.partial;
    const result = await portalTransactions(input, snapshot, repository, now());
    if ((await repository.revision()) !== snapshot.revision) {
      throw new Error(PlanningError.RESTART_REQUIRED);
    }
    return {
      ...context,
      data: result,
    };
  }
  function query(input: PlanningQuery, snapshot: PlanningSnapshot) {
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
    async execute(input: PlanningCommand): Promise<PlanningResult> {
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
        isPlanningQuery(input) ? catalogReads.get(input.tool) : undefined,
      );
      if (isPlanningQuery(input)) {
        const context = readContext(snapshot, planningSelection(input));
        snapshot.partial = context.partial;
        const result = await query(input, snapshot);
        if ((await repository.revision()) !== snapshot.revision) {
          throw new Error(PlanningError.RESTART_REQUIRED);
        }
        return { ...context, data: result };
      }
      if (!("idempotency_key" in input)) {
        throw new Error(PlanningError.CONFIRMATION_REQUIRED);
      }
      const state = structuredClone(snapshot.state);
      const result = {
        ...(await planningMutation(input, {
          now: now().toISOString(),
          repository,
          snapshot,
          state,
        })),
      };
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
