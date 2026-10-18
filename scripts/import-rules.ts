import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { z } from "zod/v4";

import { importRules, parseRuleJson } from "#domain/rules/import-rules.ts";
import { RulesSchema } from "#domain/rules/rules.ts";
import { tryCatch } from "#shared/result.ts";

import { adminEndpoint, adminRequest } from "./admin-request.ts";

export async function main(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    strict: true,
    allowPositionals: false,
    options: {
      file: { type: "string" },
      catalog: { type: "string" },
      output: { type: "string" },
      endpoint: { type: "string" },
      save: { type: "boolean", default: false },
      activate: { type: "boolean", default: false },
    },
  });
  const options = z
    .object({
      file: z.string().trim().min(1),
      catalog: z.string().trim().min(1).optional(),
      output: z.string().trim().min(1).optional(),
      endpoint: z.string().min(1).optional(),
      save: z.boolean(),
      activate: z.boolean(),
    })
    .parse(values);
  if (options.save && options.activate) {
    throw new Error("Choose --save or --activate");
  }
  const remote = options.save || options.activate;
  if (remote !== (options.endpoint !== undefined)) {
    throw new Error(
      "Use --endpoint with --save or --activate. Default: local dry run.",
    );
  }
  const endpoint = options.endpoint
    ? adminEndpoint(options.endpoint)
    : undefined;
  const token = remote
    ? z.string().min(1).parse(process.env.CADERNINHO_TOKEN)
    : "";
  const input = z
    .json()
    .parse(parseRuleJson(await readFile(options.file, "utf8")));
  const catalog = options.catalog
    ? RulesSchema.pick({ groups: true, categories: true }).parse(
        JSON.parse(await readFile(options.catalog, "utf8")),
      )
    : undefined;
  const report = importRules(input, catalog);
  console.log(
    JSON.stringify(
      {
        compatible: report.compatible,
        rules: report.document?.rules.length ?? null,
        issues: report.issues,
      },
      null,
      2,
    ),
  );
  if (!report.compatible) {
    process.exitCode = 2;
    return;
  }
  if (options.output) {
    await writeFile(
      options.output,
      `${JSON.stringify(report.document, null, 2)}\n`,
      {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      },
    );
  }
  if (!endpoint) {
    return;
  }
  const response = await adminRequest(
    new URL("/mcp/rules/import", endpoint),
    token,
    {
      document: report.document,
      mode: options.activate ? "activate" : "save",
    },
  );
  if (!response.ok) {
    throw new Error(`Import failed: HTTP ${response.status}`);
  }
  console.log(JSON.stringify(await response.json()));
}
if (import.meta.main) {
  const outcome = await tryCatch(main());
  if (outcome.error) {
    console.error(outcome.error.message);
    process.exitCode = 1;
  }
}
