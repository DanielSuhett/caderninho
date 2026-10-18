import { readRequestBody } from "@modelcontextprotocol/server";
import { z } from "zod/v4";

import { exactJSON } from "../../domain";
import { parseRuleJson } from "../../domain/rules";
import type { SafeFields } from "../observability";

const invalidRequests = new Set([
  "EMPTY_FORM",
  "FORM_TOO_LARGE",
  "DUPLICATE_FORM_FIELD",
  "SESSION_REQUIRED",
  "UNKNOWN_ACTION",
]);
export function failureStatus(error: Error): 400 | 500 {
  return error instanceof z.ZodError || invalidRequests.has(error.message)
    ? 400
    : 500;
}
const requestActions = new Map<string, NonNullable<SafeFields["action"]>>([
  ["/account", "read"],
  ["/account/login", "login"],
  ["/api/account", "read"],
  ["/api/account/connect-token", "token"],
  ["/api/account/items", "connect"],
  ["/api/account/pause", "pause"],
  ["/api/account/resume", "resume"],
  ["/api/account/sync", "sync"],
  ["/api/account/disconnect-assistants", "disconnect"],
  ["/api/account/logout", "logout"],
  ["/authorize", "authorize"],
  ["/oauth/token", "token"],
]);
export function requestCategory(
  path: string,
): Pick<SafeFields, "phase" | "action"> {
  const action = requestActions.get(path) ?? "unknown";
  if (path === "/account" || path.startsWith("/api/account")) {
    return { action, phase: "account.action" };
  }
  if (path === "/mcp") {
    return { action, phase: "mcp.call" };
  }
  if (path === "/webhook") {
    return { action, phase: "sync.admission" };
  }
  return { action, phase: "auth.request" };
}

export async function boundedJson(
  request: Request,
  maximum = 1_048_576,
  losslessRules = false,
) {
  if (!request.body) {
    throw new Error("BODY_REQUIRED");
  }
  const body = await readRequestBody(request, maximum);
  if (body.tooLarge) {
    throw new Error("BODY_LIMIT");
  }
  return losslessRules
    ? z.json().parse(parseRuleJson(body.text))
    : exactJSON(body.text);
}

export async function boundedForm(request: Request) {
  if (!request.body) {
    throw new Error("EMPTY_FORM");
  }
  const body = await readRequestBody(request, 8192);
  if (body.tooLarge) {
    throw new Error("FORM_TOO_LARGE");
  }
  const form = new URLSearchParams(body.text);
  for (const name of form.keys()) {
    if (form.getAll(name).length !== 1) {
      throw new Error("DUPLICATE_FORM_FIELD");
    }
  }
  return form;
}

export function requestOrigin(request: Request) {
  const url = new URL(request.url);
  if (
    url.protocol !== "https:" &&
    url.hostname !== "localhost" &&
    url.hostname !== "127.0.0.1"
  ) {
    throw new Error("HTTPS_REQUIRED");
  }
  return url.origin;
}
