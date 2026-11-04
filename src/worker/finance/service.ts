import {
  type AggregateQuery,
  compactTransaction,
  localDay,
  TransactionDetail,
  type TransactionQuery,
} from "../../domain";
import { hash } from "../../shared";
import type { FinancialRepository } from "./entity";

export function createFinancialService(
  repository: FinancialRepository,
  now: () => Date = () => new Date(),
) {
  return {
    aggregate: (input: AggregateQuery) =>
      repository.aggregate(input, localDay(now())),
    async query(input: TransactionQuery) {
      const filter = {
        ...input.filter,
        ...(input.filter?.accountIds && {
          accountIds: [...new Set(input.filter.accountIds)].sort(),
        }),
        ...(input.filter?.connectionIds && {
          connectionIds: [...new Set(input.filter.connectionIds)].sort(),
        }),
      };
      const result = await repository.query(
        input,
        await hash(filter),
        localDay(now()),
      );
      if (input.detail === TransactionDetail.full) {
        return result;
      }
      return { ...result, records: result.records.map(compactTransaction) };
    },
  };
}
