import {
  AuditSelectionSchema,
  HouseholdCommandSchema,
  InstitutionCatalogSelectionSchema,
  PortalMutationSchema,
  PortalQuerySchema,
  RuleJobCommandSchema,
  RuleJobSelectionSchema,
  RulePreviewSchema,
  SyncHistorySelectionSchema,
} from "../contracts";
import { RunStatus } from "../domain";
import { demoAccounts, demoReferenceDay } from "../fixtures/finance";
import { demoPortalFixture } from "../fixtures/workspace";
import { tryCatch } from "../shared";
import { demoAuditReport } from "./demo-audit";
import { createDemoSession } from "./demo-session";
import { randomId } from "./random-id";

// Injected only by demo-entry. Every request terminates here, including unknown
// endpoints: a public demo can never fall through to an installation's API.
export function createDemoFetch(
  origin: string,
  session = createDemoSession(),
): typeof fetch {
  const snapshot = { ...demoPortalFixture(), origin };
  const institutions = [
    { id: "demo-institution", logoUrl: null, name: "Banco de exemplo" },
    ...new Map(
      demoAccounts.flatMap((account) =>
        account.identity?.institution
          ? [
              [
                account.identity.institution.id,
                account.identity.institution,
              ] as const,
            ]
          : [],
      ),
    ).values(),
  ];
  const read = (url: URL) => {
    switch (url.pathname) {
      case "/api/account":
        snapshot.connections = snapshot.connections.map((connection) => ({
          ...connection,
          accounts: Object.fromEntries(
            Object.entries(connection.accounts).map(([id, account]) => [
              id,
              {
                ...account,
                identity:
                  session.view().accounts.find((row) => row.id === id)
                    ?.identity ?? null,
              },
            ]),
          ),
        }));
        return snapshot;
      case "/api/account/institutions": {
        const { profileId } = InstitutionCatalogSelectionSchema.parse(
          Object.fromEntries(url.searchParams),
        );
        if (!snapshot.profiles.some((profile) => profile.id === profileId)) {
          throw new Error("NOT_FOUND");
        }
        return { records: institutions };
      }
      case "/api/account/catalog":
        return session.catalog(url.searchParams.get("spaceId") ?? "personal");
      case "/api/account/rule-jobs":
        return session.api
          .ruleJob(
            RuleJobSelectionSchema.parse(Object.fromEntries(url.searchParams)),
            new AbortController().signal,
          )
          .then((job) => ({ job }));
      case "/api/account/history": {
        const selection = SyncHistorySelectionSchema.parse(
          Object.fromEntries(url.searchParams),
        );
        return {
          cursor: null,
          records: snapshot.connections
            .filter(
              (row) =>
                (!selection.connectionId ||
                  row.id === selection.connectionId) &&
                (!selection.personId || row.personId === selection.personId) &&
                (!selection.status || selection.status === RunStatus.succeeded),
            )
            .map((row) => ({
              admittedAt: `${demoReferenceDay}T11:59:00.000Z`,
              connectionId: row.id,
              error: null,
              finishedAt: row.lastSuccessAt,
              id: `demo-import:${row.id}`,
              personId: row.personId,
              personName: row.personName,
              phase: null,
              profileId: row.profileId,
              profileName: row.profileName,
              sequence: 1,
              status: RunStatus.succeeded,
            })),
        };
      }
      case "/api/account/audit": {
        const { days } = AuditSelectionSchema.parse(
          Object.fromEntries(url.searchParams),
        );
        return demoAuditReport(days, demoReferenceDay);
      }
      default:
        return null;
    }
  };
  const write = async (request: Request, url: URL) => {
    const input: unknown = await request.json();
    switch (url.pathname) {
      case "/api/account/query": {
        const { query, csrf } = PortalQuerySchema.parse(input);
        return await session.api.query(query, csrf, request.signal);
      }
      case "/api/account/planning": {
        const { command, csrf } = PortalMutationSchema.parse(input);
        return await session.api.planning(command, csrf, request.signal);
      }
      case "/api/account/rule-jobs":
        return {
          job: await session.api.ruleJobs(
            RuleJobCommandSchema.parse(input),
            request.signal,
          ),
        };
      case "/api/account/rule-preview":
        return await session.api.previewRule(
          RulePreviewSchema.parse(input),
          request.signal,
        );
      case "/api/account/manage": {
        const command = HouseholdCommandSchema.parse(input);
        if (command.action === "set_connection_institution") {
          const connection = snapshot.connections.find(
            (row) => row.id === command.connectionId,
          );
          const institution =
            institutions.find((row) => row.id === command.institutionId) ??
            null;
          if (
            !connection?.personId ||
            (command.institutionId && !institution)
          ) {
            throw new Error("NOT_FOUND");
          }
          session.identifyInstitution({
            accountIds: Object.keys(connection.accounts),
            institution,
          });
          return { ok: true };
        }
        if (command.action !== "save_person") {
          throw new Error("UNSUPPORTED_DEMO_OPERATION");
        }
        const id = command.id ?? `demo:${randomId()}`;
        const existing = snapshot.people.find((row) => row.id === id);
        const person = {
          ...existing,
          id,
          name: command.name,
          ...(command.photo !== undefined && { photo: command.photo ?? "" }),
        };
        snapshot.people = [
          ...snapshot.people.filter((row) => row.id !== id),
          person,
        ];
        return { id };
      }
      case "/api/account/logout":
        return { ok: true };
      default:
        return null;
    }
  };
  return async (input, init) => {
    const request = new Request(input, init);
    request.signal.throwIfAborted();
    const url = new URL(request.url);
    if (url.origin !== origin || !url.pathname.startsWith("/api/account")) {
      return Response.json(
        { error: "DEMO_ENDPOINT_UNAVAILABLE" },
        { status: 404 },
      );
    }
    const { data, error } = await tryCatch(() =>
      request.method === "GET" ? read(url) : write(request, url),
    );
    request.signal.throwIfAborted();
    if (error) {
      const conflict =
        error.message === "RESTART_REQUIRED" ||
        error.message === "JOB_ACTIVE" ||
        error.message === "IDEMPOTENCY_CONFLICT";
      return Response.json(
        { error: "DEMO_OPERATION_FAILED" },
        { status: conflict ? 409 : 400 },
      );
    }
    return data === null
      ? Response.json({ error: "DEMO_ENDPOINT_UNAVAILABLE" }, { status: 404 })
      : Response.json(data);
  };
}
