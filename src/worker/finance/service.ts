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
      return repository.query(
        input,
        await hash(input.filter ?? {}),
        localDay(now()),
      );
    },
  };
}
