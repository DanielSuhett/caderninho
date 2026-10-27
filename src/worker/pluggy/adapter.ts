import { z } from "zod/v4";

import {
  connectorInstitution,
  PluggyCredentialsSchema,
  type ProductKind,
} from "../../domain";
import { PersonalPluggyClient } from "./client.adapter";
import { productPage } from "./products";
import { connectToken, financialSource, sdkResult } from "./source";

const connectorCatalog = z.object({
  results: z
    .array(
      z.object({
        id: z.union([z.string(), z.number()]),
        imageUrl: z.string().nullish(),
        isSandbox: z.boolean(),
        name: z.string(),
        type: z.string(),
      }),
    )
    .max(1000),
  totalPages: z.coerce.number().int().nonnegative(),
});
export function createPluggyAdapter(input: {
  clientId: string | undefined;
  clientSecret: string | undefined;
}) {
  const parsed = PluggyCredentialsSchema.safeParse(input);
  let current: PersonalPluggyClient | undefined;
  function client() {
    if (!parsed.success) {
      throw new Error("NOT_CONFIGURED");
    }
    current ??= new PersonalPluggyClient(parsed.data);
    return current;
  }
  return {
    accounts: (id: string) => financialSource(client()).accounts(id),
    connection: (id: string) => financialSource(client()).connection(id),
    async institutions() {
      const page = connectorCatalog.parse(
        await sdkResult(() =>
          client().fetchConnectors({ countries: ["BR"], sandbox: false }),
        ),
      );
      if (page.totalPages > 1) {
        throw new Error("INCOMPLETE_PAGE");
      }
      return page.results
        .filter(
          (row) =>
            !row.isSandbox &&
            [
              "PERSONAL_BANK",
              "BUSINESS_BANK",
              "INVESTMENT",
              "PAYMENT_ACCOUNT",
            ].includes(row.type),
        )
        .flatMap((row) => {
          const institution = connectorInstitution(row);
          return institution ? [institution] : [];
        })
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    },
    products: (request: {
      kind: ProductKind;
      id: string;
      page: number;
      observedAt: string;
    }) => productPage(client(), request),
    token: (id?: string) => connectToken(client(), id),
    transactions: (id: string, cursor: string | null) =>
      financialSource(client()).transactions(id, cursor),
  };
}
