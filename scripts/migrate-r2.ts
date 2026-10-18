// Reads an explicitly exported R2 directory. Never deletes R2 or touches it remotely.
import { readdir, readFile } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import { parseArgs } from "node:util";

import { z } from "zod/v4";

import { MigrationRowSchema } from "#contracts/operation.ts";
import { DEFINITIONS } from "#domain/finance-model.ts";
import { SnapshotSchema, FinanceRecordSchema } from "#domain/schemas.ts";
import { tryCatch } from "#shared/result.ts";
import { hash } from "#worker/database.ts";

import { adminEndpoint, adminRequest } from "./admin-request.ts";

export async function main(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    strict: true,
    allowPositionals: false,
    options: {
      directory: { type: "string" },
      item: { type: "string" },
      overlap: { type: "string" },
      endpoint: { type: "string" },
      apply: { type: "boolean", default: false },
      policy: { type: "string", default: "refuse-conflicts" },
      "batch-size": { type: "string", default: "20" },
    },
  });
  const options = z
    .object({
      directory: z.string().trim().min(1),
      item: z.string().trim().min(1),
      overlap: z.literal("newest").optional(),
      endpoint: z.string().min(1).optional(),
      apply: z.boolean(),
      policy: z.enum(["refuse-conflicts", "keep-current", "prefer-bundle"]),
      "batch-size": z.coerce.number().int().min(1).max(20),
    })
    .parse(values);
  if (options.apply && !options.endpoint)
    throw new Error("--apply requires --endpoint");
  const endpoint = options.endpoint
    ? adminEndpoint(options.endpoint)
    : undefined;
  const token = endpoint
    ? z.string().min(1).parse(process.env.CADERNINHO_TOKEN)
    : "";
  const root = resolve(options.directory),
    itemId = options.item,
    selected = new Map<string, z.infer<typeof MigrationRowSchema>>();
  let overlaps = 0,
    manifests = 0;
  async function visit(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(file);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const parsed = SnapshotSchema.safeParse(
        JSON.parse(await readFile(file, "utf8")),
      );
      if (!parsed.success || parsed.data.itemId !== itemId) continue;
      manifests++;
      for (const collection of Object.values(parsed.data.collections)) {
        if (!collection.dataKey) continue;
        const dataFile = resolve(root, collection.dataKey);
        if (relative(root, dataFile).startsWith(".."))
          throw new Error("INVALID_R2_KEY");
        const data = z
          .object({ records: z.array(FinanceRecordSchema) })
          .parse(JSON.parse(await readFile(dataFile, "utf8")));
        for (const record of data.records) {
          const parent = DEFINITIONS[collection.resource].parent;
          const parentId = parent
            ? z
                .string()
                .parse(
                  parent === "investments"
                    ? record.investmentId
                    : record.accountId,
                )
            : "";
          const row = MigrationRowSchema.parse({
            sourceKey: collection.dataKey + "#" + record.id,
            readAt: collection.readAt,
            resource: collection.resource,
            parentId,
            record,
          });
          const key = JSON.stringify([row.resource, parentId, record.id]),
            prior = selected.get(key);
          if (prior && (await hash(prior.record)) !== (await hash(record))) {
            overlaps++;
            if (options.overlap !== "newest")
              throw new Error(
                "Overlapping exported records differ. Review export and explicitly choose --overlap newest.",
              );
            if (prior.readAt === row.readAt)
              throw new Error(
                "Equal reference time with conflicting records requires manual resolution in a copy of the export.",
              );
          }
          if (!prior || prior.readAt < row.readAt) selected.set(key, row);
        }
      }
    }
  }
  await visit(root);
  if (!manifests)
    throw new Error(
      "No supported snapshots for the requested Item. Legacy v1 exports require an explicit converter; nothing imported.",
    );
  console.log(
    JSON.stringify({
      manifests,
      records: selected.size,
      overlaps,
      financialCoverage: "historical projection; bootstrap still required",
      applied: false,
    }),
  );
  if (!endpoint) return;
  const size = options["batch-size"],
    all = [...selected.values()];
  for (let offset = 0; offset < all.length; offset += size) {
    const response = await adminRequest(
      new URL("/mcp/migration", endpoint),
      token,
      {
        itemId,
        rows: all.slice(offset, offset + size),
        policy: options.policy,
        apply: options.apply,
      },
    );
    if (!response.ok)
      throw new Error(
        `Migration HTTP ${response.status}; committed batches remain. Reuse identical input to resume.`,
      );
    console.log(JSON.stringify(await response.json()));
  }
}
if (import.meta.main) {
  const result = await tryCatch(main());
  if (result.error) {
    console.error(result.error.message);
    process.exitCode = 1;
  }
}
