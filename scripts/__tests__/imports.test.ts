import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import {
  checkImports,
  importSpecifiers,
  projectRoot,
} from "../check-imports.ts";

await test("Oxc checks static, dynamic, reexported and type-only architectural edges", async () => {
  const cases = [
    [
      "src/worker/finance/corrections.ts",
      'import { database } from "#worker/database.ts";',
      "imports #worker/database",
    ],
    [
      "src/worker/account/connection/service.ts",
      'import { connectToken } from "#worker/pluggy/source.ts";',
      "imports #worker/pluggy/",
    ],
    [
      "src/worker/finance/entities.repository.ts",
      'import type { ToolCall } from "#contracts/mcp-contract.ts";',
      "depends on MCP envelope",
    ],
    [
      "src/web/account/account-view.tsx",
      'import { createAccountApi } from "./account-api.ts";',
      "view depends on interaction/transport",
    ],
    [
      "src/web/account/account-view.tsx",
      'const widget = import("./connect-widget.ts");',
      "view depends on interaction/transport",
    ],
    [
      "src/web/account/account-view.tsx",
      'import ky from "ky";',
      "view depends on interaction/transport",
    ],
    [
      "src/domain/probe.ts",
      'import type { ToolCall } from "#contracts/mcp-contract.ts";',
      "domain depends on contracts",
    ],
    [
      "src/shared/probe.ts",
      'export * from "#domain/enums.ts";',
      "shared depends on application-specific",
    ],
    [
      "src/contracts/probe.ts",
      'export { readAccount } from "#worker/pluggy/source.ts";',
      "imports #worker/",
    ],
    [
      "src/web/probe.tsx",
      'const source = import("#worker/composition.ts");',
      "imports #worker/",
    ],
    [
      "src/worker/finance/service.ts",
      'type DB = import("#worker/bindings.ts").Bindings;',
      "imports #worker/bindings",
    ],
    [
      "src/worker/account/controller.ts",
      'export { database } from "#worker/database.ts";',
      "imports #worker/database",
    ],
    [
      "src/worker/finance/service.ts",
      'const repository = import("#worker/finance/repository.ts");',
      "imports #worker/finance/repository",
    ],
    [
      "src/worker/finance/service.ts",
      'import { eq } from "drizzle-orm";',
      "imports drizzle-orm",
    ],
    [
      "src/domain/probe.ts",
      'import { readFile } from "node:fs/promises";',
      "imports node:",
    ],
    [
      "src/worker/probe.ts",
      'import { required } from "#testing/helpers.ts";',
      "test-only module",
    ],
    ["scripts/probe.ts", 'import "#domain/missing.ts";', "cannot resolve"],
    ["src/worker/probe.ts", 'import "#unknown/file.ts";', "cannot resolve"],
    [
      "src/worker/probe.ts",
      'import "#shared/result";',
      "needs an explicit extension",
    ],
    [
      "src/worker/probe.ts",
      'import "./bindings";',
      "needs an explicit extension",
    ],
  ] as const;
  for (const [file, source, message] of cases) {
    assert.ok(
      (await checkImports(join(projectRoot, file), source)).some((violation) =>
        violation.includes(message),
      ),
      file,
    );
  }
  for (const [file, source] of [
    ["src/domain/probe.ts", 'import { decimal } from "#domain/exact.ts";'],
    ["src/worker/probe.ts", 'export * from "./bindings.ts";'],
    [
      "src/worker/account/service.ts",
      'import type { createAccountRepository } from "#worker/account/repository.ts";',
    ],
    ["src/web/probe.tsx", 'import "./account.css";'],
    ["tests/probe.ts", 'import { required } from "#testing/helpers.ts";'],
    [
      "src/worker/finance/corrections.ts",
      'import { recordChange } from "#domain/record-correction.ts";',
    ],
    [
      "src/worker/sync/publication.ts",
      'import { database } from "#worker/database.ts";',
    ],
    [
      "src/web/account/account-view.tsx",
      'import { syncPresentation } from "./account-model.ts";',
    ],
  ] as const) {
    assert.deepEqual(await checkImports(join(projectRoot, file), source), []);
  }
  assert.deepEqual(
    importSpecifiers(
      "fixture.ts",
      'const text = "unrelated"; // import("ignored")\nconst module = import(name);',
    ),
    [],
  );
  assert.throws(() => importSpecifiers("broken.ts", "import {"), /broken.ts/);
});
