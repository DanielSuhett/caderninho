import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseSync, Visitor } from "oxc-parser";

import { tryCatch } from "#shared/result.ts";

export const projectRoot = path.resolve(import.meta.dirname, "..");

function importDependencies(file: string, source: string) {
  const parsed = parseSync(file, source);
  if (parsed.errors.length) {
    throw new Error(
      `${file}: ${parsed.errors.map((error) => error.message).join("; ")}`,
    );
  }
  const dependencies: { specifier: string; typeOnly: boolean }[] = [];
  const add = (specifier: string, typeOnly = false) => {
    dependencies.push({ specifier, typeOnly });
  };
  new Visitor({
    ImportDeclaration(node) {
      add(
        node.source.value,
        node.importKind === "type" ||
          (node.specifiers.length > 0 &&
            node.specifiers.every(
              (specifier) =>
                specifier.type === "ImportSpecifier" &&
                specifier.importKind === "type",
            )),
      );
    },
    ExportNamedDeclaration(node) {
      if (node.source) {
        add(node.source.value, node.exportKind === "type");
      }
    },
    ExportAllDeclaration(node) {
      add(node.source.value, node.exportKind === "type");
    },
    ImportExpression(node) {
      if (
        node.source.type === "Literal" &&
        typeof node.source.value === "string"
      ) {
        add(node.source.value);
      }
    },
    TSImportType(node) {
      add(node.source.value, true);
    },
  }).visit(parsed.program);
  return dependencies;
}

export function importSpecifiers(file: string, source: string): string[] {
  return importDependencies(file, source).map(({ specifier }) => specifier);
}

async function files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const found: string[] = [];
  for (const entry of entries) {
    if (["node_modules", "dist", ".wrangler", "vendor"].includes(entry.name)) {
      continue;
    }
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await files(file)));
    } else if (entry.name !== "runtime.d.ts" && /\.[cm]?tsx?$/.test(file)) {
      found.push(file);
    }
  }
  return found;
}

export async function checkImports(
  file: string,
  source: string,
): Promise<string[]> {
  const violations: string[] = [];
  const relative = path.relative(projectRoot, file).split(path.sep).join("/");
  const area = relative.split("/").slice(0, 2).join("/");
  const test =
    relative.startsWith("tests/") || relative.includes("/__tests__/");
  for (const { specifier, typeOnly } of importDependencies(file, source)) {
    const internal = specifier.startsWith(".") || specifier.startsWith("#");
    let resolved = specifier;
    if (internal) {
      if (!/\.[cm]?(?:tsx?|json|css)$/.test(specifier)) {
        violations.push(
          `${relative} needs an explicit extension: ${specifier}`,
        );
      }
      const target = await tryCatch(
        Promise.resolve().then(() =>
          specifier.startsWith("#")
            ? fileURLToPath(import.meta.resolve(specifier))
            : path.resolve(path.dirname(file), specifier),
        ),
      );
      const exists = target.error ? target : await tryCatch(stat(target.data));
      if (target.error || exists.error || !exists.data.isFile()) {
        violations.push(`${relative} cannot resolve ${specifier}`);
        continue;
      }
      resolved = path
        .relative(projectRoot, target.data)
        .split(path.sep)
        .join("/");
    }
    if (test) {
      continue;
    }
    if (resolved.includes("/__tests__/") || resolved.startsWith("tests/")) {
      violations.push(`${relative} imports test-only module ${specifier}`);
    }
    if (
      area === "src/shared" &&
      internal &&
      !resolved.startsWith("src/shared/")
    ) {
      violations.push(
        `${relative}: shared depends on application-specific module ${specifier}`,
      );
    }
    const infra =
      /^(?:node:|cloudflare:|@cloudflare\/|@modelcontextprotocol\/|drizzle-orm|hono|react|ky$|pluggy-sdk|pluggy-connect-sdk)/.test(
        resolved,
      );
    // Application helpers keep service boundaries even after extraction/renaming.
    // These durable flows deliberately own SQL and atomic publication batches.
    const durablePersistence =
      /^src\/worker\/sync\/(?:publication|resources|events|reapplication|migration)\.ts$/.test(
        relative,
      );
    const persistenceFile =
      /(?:\/|\.)repository\.ts$/.test(relative) ||
      relative === "src/worker/sync/operation-storage.ts";
    const adapterFile = /(?:\/|\.)adapter\.ts$/.test(relative);
    const service =
      /^src\/worker\/(?:account|auth|finance|sync)\//.test(relative) &&
      !persistenceFile &&
      !adapterFile &&
      !durablePersistence &&
      !/(?:\/|\.)(?:controller|session|workflow)\.ts$/.test(relative);
    const controller = /^src\/worker\/[^/]+\/(?:controller|tasks)\.ts$/.test(
      relative,
    );
    const sql = /^(?:drizzle-orm|src\/worker\/(?:database|schema)\.ts)/.test(
      resolved,
    );
    const repository = /^src\/worker\/.+(?:\/|\.)repository\.ts$/.test(
      resolved,
    );
    let forbidden = false;
    if (service) {
      forbidden =
        infra ||
        sql ||
        /^src\/worker\/(?:bindings|composition|http)\.ts$/.test(resolved) ||
        /^src\/worker\/(?:pluggy|mcp)\//.test(resolved) ||
        resolved === "src/worker/sync/operation-storage.ts" ||
        /^src\/worker\/[^/]+\/(?:controller|session|workflow)\.ts$/.test(
          resolved,
        ) ||
        ((repository || /(?:\/|\.)adapter\.ts$/.test(resolved)) && !typeOnly);
    } else if (controller && sql) {
      forbidden = true;
    } else if (["src/domain", "src/contracts", "src/shared"].includes(area)) {
      forbidden = infra || /^src\/(?:worker|web)\//.test(resolved);
    } else if (area === "src/web") {
      forbidden = resolved.startsWith("src/worker/");
    }
    if (forbidden) {
      violations.push(`${relative} imports ${specifier}`);
    }
    if (
      (service || persistenceFile) &&
      resolved === "src/contracts/mcp-contract.ts"
    ) {
      violations.push(
        `${relative}: application/persistence depends on MCP envelope ${specifier}`,
      );
    }
    const view = area === "src/web" && /(?:^|[/-])view\.tsx$/.test(relative);
    if (
      view &&
      (/^(?:ky|pluggy-connect-sdk|pluggy-sdk)$/.test(resolved) ||
        /^src\/web\/account\/(?:account-api|connect-widget|use-account)\.ts$/.test(
          resolved,
        ))
    ) {
      violations.push(
        `${relative}: view depends on interaction/transport ${specifier}`,
      );
    }
    if (area === "src/domain" && resolved.startsWith("src/contracts/")) {
      violations.push(`${relative}: domain depends on contracts`);
    }
  }
  return violations;
}

export async function checkProjectImports(): Promise<string[]> {
  const violations: string[] = [];
  for (const area of ["src", "scripts", "tests"]) {
    for (const file of await files(path.join(projectRoot, area))) {
      violations.push(
        ...(await checkImports(file, await readFile(file, "utf8"))),
      );
    }
  }
  for (const entry of await readdir(projectRoot)) {
    if (/\.[cm]?tsx?$/.test(entry)) {
      const file = path.join(projectRoot, entry);
      violations.push(
        ...(await checkImports(file, await readFile(file, "utf8"))),
      );
    }
  }
  return violations;
}

if (import.meta.main) {
  const violations = await checkProjectImports();
  if (violations.length) {
    throw new Error(violations.join("\n"));
  }
  process.stdout.write(
    "Import boundaries passed: domain, contracts, services, controllers, browser, tooling and tests.\n",
  );
}
