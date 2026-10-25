import { readRequestBody } from "@modelcontextprotocol/server";
import { z } from "zod/v4";

import type { SafeFields } from "../observability";

const invalidRequests = new Set([
  "CARD_REQUIRED",
  "INVALID_RULE",
  "INVALID_RULE_IMPORT_CATEGORY",
  "SPACE_PROTECTED",
  "SPACE_NOT_EMPTY",
  "SPACE_MISMATCH",
  "EMPTY_FORM",
  "BODY_REQUIRED",
  "FORM_TOO_LARGE",
  "DUPLICATE_FORM_FIELD",
  "SESSION_REQUIRED",
  "UNKNOWN_ACTION",
  "PROFILE_OWNER_IMMUTABLE",
  "APPLICATION_CHANGE_REQUIRES_NEW_PROFILE",
  "PROFILE_EXISTS",
  "CREDENTIALS_REQUIRED",
  "PROFILE_DISABLED",
  "SOURCE_IDENTITY_MISMATCH",
]);
export function failureStatus(
  error: Error,
): 400 | 403 | 404 | 409 | 413 | 500 | 503 {
  if (error.message === "BODY_LIMIT") {
    return 413;
  }
  if (error.message === "SESSION_REQUIRED") {
    return 403;
  }
  if (error.message === "NOT_FOUND") {
    return 404;
  }
  if (error.message === "NOT_CONFIGURED") {
    return 503;
  }
  if (
    error.message === "ITEM_LIMIT" ||
    error.message === "RESTART_REQUIRED" ||
    error.message === "IDEMPOTENCY_CONFLICT"
  ) {
    return 409;
  }
  return error instanceof z.ZodError ||
    error instanceof SyntaxError ||
    invalidRequests.has(error.message)
    ? 400
    : 500;
}
const requestActions = new Map<string, NonNullable<SafeFields["action"]>>([
  ["/account", "read"],
  ["/account/login", "login"],
  ["/api/account", "read"],
  ["/api/account/connect-token", "token"],
  ["/api/account/items", "connect"],
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
  if (path === "/mcp" || path.startsWith("/mcp/")) {
    return { action, phase: "mcp.call" };
  }
  return { action, phase: "auth.request" };
}

export async function boundedJson(request: Request, maximum = 1_048_576) {
  if (!request.body) {
    throw new Error("BODY_REQUIRED");
  }
  const body = await readRequestBody(request, maximum);
  if (body.tooLarge) {
    throw new Error("BODY_LIMIT");
  }
  return z.json().parse(JSON.parse(body.text));
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
