import type {
  AggregateQuery,
  TransactionCorrection,
  TransactionQuery,
} from "../../domain";
import { localDay } from "../../domain";
import { hash } from "../../shared";
import type { FinancialRepository } from "./entity";

export function createFinancialService(
  repository: FinancialRepository,
  now: () => Date = () => new Date(),
) {
  return {
    accounts: repository.accounts,
    aggregate: (input: AggregateQuery) =>
      repository.aggregate(input, localDay(now())),
    correct: (input: TransactionCorrection) =>
      repository.correct(input, now().toISOString()),
    async query(input: TransactionQuery) {
      return repository.query(
        input,
        await hash(input.filter ?? {}),
        localDay(now()),
      );
    },
  };
}
