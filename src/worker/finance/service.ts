import type { AggregateQuery, TransactionQuery } from "../../domain";
import { localDay } from "../../domain";
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
      return repository.query(input, await hash(filter), localDay(now()));
    },
  };
}
