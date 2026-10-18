import { readRequestBody } from "@modelcontextprotocol/server";
import { z } from "zod/v4";

import { exactJSON } from "#domain/exact.ts";
import { parseRuleJson } from "#domain/rules/import-rules.ts";

const invalidRequests = new Set([
  "EMPTY_FORM",
  "FORM_TOO_LARGE",
  "DUPLICATE_FORM_FIELD",
  "CONSENT_REQUIRED",
  "UNKNOWN_ACTION",
]);
export function failureStatus(error: Error): 400 | 500 {
  return error instanceof z.ZodError || invalidRequests.has(error.message)
    ? 400
    : 500;
}
export function requestDiagnostic(input: {
  correlation: string;
  status: number;
  durationMs: number;
  route: string;
}) {
  // Deliberately omit URL, query strings, bodies, identities and exception text.
  console.info({
    code: input.status >= 500 ? "REQUEST_FAILED" : "REQUEST_COMPLETED",
    ...input,
  });
}

export async function boundedJson(
  request: Request,
  maximum = 1048576,
  losslessRules = false,
) {
  if (!request.body) throw new Error("BODY_REQUIRED");
  const body = await readRequestBody(request, maximum);
  if (body.tooLarge) throw new Error("BODY_LIMIT");
  return z.json().parse((losslessRules ? parseRuleJson : exactJSON)(body.text));
}

export async function boundedForm(request: Request) {
  if (!request.body) throw new Error("EMPTY_FORM");
  const body = await readRequestBody(request, 8192);
  if (body.tooLarge) throw new Error("FORM_TOO_LARGE");
  const form = new URLSearchParams(body.text);
  for (const name of form.keys())
    if (form.getAll(name).length !== 1) throw new Error("DUPLICATE_FORM_FIELD");
  return form;
}
