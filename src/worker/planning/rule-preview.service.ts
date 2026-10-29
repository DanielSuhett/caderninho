import type { RulePreviewQuery, RulePreviewResult } from "../../contracts";
import {
  PlanningError,
  ruleMatches,
  transactionCounterparty,
} from "../../domain";
import type { PlanningRepository } from "./entity";
import { found, transactionStream } from "./projection";

const scanLimit = 10_000;
export async function previewRule(
  repository: PlanningRepository,
  input: RulePreviewQuery,
): Promise<RulePreviewResult> {
  const snapshot = await repository.read();
  found(snapshot.state.spaces.find((space) => space.id === input.spaceId));
  let examined = 0;
  let truncated = false;
  const bounded: Pick<PlanningRepository, "transactions"> = {
    async *transactions(ids, selection) {
      for await (const page of repository.transactions(ids, selection)) {
        const remaining = scanLimit - examined;
        const selected = page.slice(0, remaining);
        examined += selected.length;
        yield selected;
        if (page.length > remaining) {
          truncated = true;
          return;
        }
      }
    },
  };
  const result: RulePreviewResult = {
    count: 0,
    examined: 0,
    partial: snapshot.partial,
    revision: snapshot.revision,
    samples: [],
    truncated: false,
  };
  const stream = transactionStream(bounded, snapshot);
  for await (const row of stream({
    include_ignored: false,
    spaceId: input.spaceId,
  })) {
    if (row.manual) {
      if (examined >= scanLimit) {
        truncated = true;
        break;
      }
      examined += 1;
    }
    if (!ruleMatches(row, input)) {
      continue;
    }
    result.count += 1;
    if (result.samples.length < 5) {
      result.samples.push({
        accountId: row.accountId,
        amountMinor: row.amountMinor,
        counterparty: transactionCounterparty(row.identification).name,
        currency: row.currency,
        date: row.date,
        description: row.description,
        id: row.id,
        personName: row.personName,
      });
    }
  }
  if ((await repository.revision()) !== snapshot.revision) {
    throw new Error(PlanningError.RESTART_REQUIRED);
  }
  return { ...result, examined, truncated };
}
