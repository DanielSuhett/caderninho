import { readRequestBody } from "@modelcontextprotocol/server";
import type { Logger } from "pino";
import { z } from "zod/v4";

import { exactJSON } from "../../domain";
import { parseRuleJson } from "../../domain/rules";
import { logger } from "../../shared/logger";

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
export function requestDiagnostic(
  input: {
    correlation: string;
    status: number;
    durationMs: number;
    route: string;
  },
  output: Pick<Logger, "debug" | "warn" | "error"> = logger,
) {
  // Deliberately omit URL, query strings, bodies, identities and exception text.
  const diagnostic = {
    correlation: input.correlation,
    durationMs: input.durationMs,
    route: input.route,
    status: input.status,
  };
  if (input.status >= 500) {
    output.error({ code: "REQUEST_FAILED", ...diagnostic });
    return;
  }
  if (input.status >= 400) {
    output.warn({ code: "REQUEST_REJECTED", ...diagnostic });
    return;
  }
  output.debug({ code: "REQUEST_COMPLETED", ...diagnostic });
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
