# Caderninho development

The product is a modular monolith in one npm package: src/worker (Cloudflare, MCP,
D1, Workflows), src/web (React, Kumo, Vite), src/domain (pure financial logic),
src/contracts (Zod public schemas) and src/shared (generic utilities).
scripts contains tooling; tools/oxlint contains lint rules and their provenance.
Use the Node 24 line in .nvmrc (nvm use) and npm ci at the repository root.
engine-strict rejects unsupported Node versions. package.json owns all dependencies
and commands; package-lock.json is the only lockfile. wrangler.jsonc is the single
production deployment configuration. Migration files retain their existing order.

Worker code is grouped by feature: account, auth, finance, sync and mcp. Each
feature keeps controllers, services and concrete repositories together. Controllers
handle transport and delegate actions; services use explicit function dependencies;
repositories own SQL. Services may import repository types, but never repository
implementations, bindings or HTTP/runtime code. Controllers cannot import SQL,
database helpers or the D1 schema. composition.ts binds dependencies per request
or operation, without global private state, decorators or a DI container.
sync retains cohesive durable persistence flows beside its service/repository;
preserve their step names and atomic batches. Pluggy client/vault and shared
database, schema and HTTP helpers stay outside the feature modules.

Application helpers inside account/auth/finance/sync keep service boundaries even
when not named service.ts. Concrete transport adapters use *.adapter.ts; durable
sync flows and operation-storage.ts retain their explicit persistence role.
MCP parsing/dispatch belongs to mcp/invoke.ts. Financial services and repositories
receive named inputs, never ToolCall envelopes. D1 operation rows and checkpoint
schemas stay in sync/operation-storage.ts; public contracts contain commands and
public state, not serialized row flags.

The account view receives presentation and named actions. Keep HTTP/CSRF parsing
in account-api.ts and SDK lifecycle in connect-widget.ts; use-account.ts owns
coordination, cancellation and polling. Preserve earlier evidence on transient
failure, reject stale responses and stop polling on session expiry/unmount.
Pluggy remains an injected ingestion/live-read adapter: local queries, corrections
and operation progress must continue to work without upstream/vault availability.

Unit tests belong in __tests__ next to the modules they cover. Worker integration
and runtime fixtures belong in tests/integration.
Shared test helpers live in tests/support. Use #shared/, #domain/, #contracts/,
#worker/, #web/ and #testing/ imports from package.json with explicit extensions.
Shared utilities are independent of financial and application modules; #testing/
is test-only. Node, TypeScript, Vite, Vitest and Wrangler resolve native package
imports without a custom loader or duplicated aliases. A single tsconfig.json
checks all source, tooling and tests using NodeNext, with Node, browser and
Cloudflare types. The import checker enforces module boundaries. TypeScript 7
enables verbatimModuleSyntax, erasableSyntaxOnly, noUncheckedIndexedAccess and
exactOptionalPropertyTypes; narrow missing values and omit absent optional fields.

## Formatting and imports

Oxfmt owns layout and sorting: 80 columns, spaces, one JSX attribute per line,
preserved object wrapping, builtins/external/package imports/relative imports/styles.
Side-effect imports retain their order. Combine values and inline types in one
import; use import type when all bindings are types. Reexport local bindings when
already imported, preserving names and aliases. Review commented duplicates
manually when a safe fix cannot consolidate them.

Oxlint checks duplicate imports/reexports and semantic promise, await and type
export rules; tsc remains a separate check. Keep project/require-readable-spacing
for structural spacing. Do not add a second sorting or stylistic preset. The Oxc
import checker covers static/dynamic literal imports, reexports and type references
using native package imports plus explicit relative paths.

## Boundaries

- Financial calculations and Pluggy behavior belong to domain modules. Use
  TypeScript ESM and Zod v4 schemas as model sources; export types through z.infer.
  Use standardized domain enums, pure functions and early returns. No any,
  chained assertions, non-null assertions or TypeScript suppression.
- Async recovery uses tryCatch and its discriminated Result union. Normalize caught
  values to Error; synchronous parse catches are allowed. Unknown belongs only at
  input/transport/storage boundaries and must be parsed before consumption.
- Authentication uses maintained Cloudflare OAuth, with identity bound per request.
  Never trust user-authored identity headers or share private tool results between
  requests. Synthetic identity headers belong only in tests/integration/runtime.ts.
- Queries read D1. Never coordinate imports from a question. Workflow checkpoints
  commit with data. Tasks use official 2026-07-28 schemas, not experimental Tasks
  2025. D1 is the default progress source; native Workflow subscribe is optional.
- R2 is only a migration source. Preserve real data and history. Use synthetic
  storage/network fixtures; never commit private bank data, secrets or exports.
- No deployment, real-data migration, merge or remote data removal without a
  separate explicit instruction. Do not claim client/runtime portability without
  execution evidence.

## Checks

From the repository root: npm test, npm run test:product, npm run lint,
npm run format:check, npm run typecheck, npm run check:imports, npm run build
and npm run test:product:runtime.
Worker runtime types: npm run types. Local D1 migrations: npm run migrate:local.
Build output: dist/web assets and dist/worker dry-run. Migrations live in migrations/.

npm run format writes Oxfmt changes; review import consolidation and formatting
separately from behavior. npm run lint:fix followed by npm run format must converge
without further changes. Node tooling tests cover safe import fixes, CLI validation
and subprocess shutdown. Administrative CLIs default to dry runs and enforce a
45-second request deadline. Prerender uses react-dom/server and exits naturally.
Fix failing checks at their cause; do not blanket-disable rules. Keep OPF-derived
Oxlint rules and provenance in tools/oxlint/project. Preserve public MCP contracts
unless changes are intentional and reviewed. Local tests and dry-run builds do not
prove deployment, real OAuth login or native MCP client catalog support.
