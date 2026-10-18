import type { WizardIssue } from "#contracts/wizard-contract.ts";

export function wizardIssue(error: Error): WizardIssue {
  const code = "code" in error ? String(error.code) : error.message;
  if (
    [
      "UPSTREAM_AUTH",
      "UPSTREAM_FORBIDDEN",
      "PLUGGY_ACCOUNT_NOT_CONFIGURED",
    ].includes(code)
  ) {
    return "credentials";
  }
  if (code === "APPLICATION_CHANGE_REQUIRES_MIGRATION") {
    return "application";
  }
  if (["UPSTREAM_RATE_LIMIT", "CONNECT_RATE_LIMIT"].includes(code)) {
    return "rate";
  }
  if (code === "MEU_PLUGGY_REQUIRED") {
    return "connector";
  }
  if (
    [
      "SOURCE_SCOPE_MISMATCH",
      "UPSTREAM_NOT_FOUND",
      "ITEM_LIMIT",
      "ITEM_NOT_AUTHORIZED",
    ].includes(code)
  ) {
    return "item";
  }
  if (
    [
      "UPSTREAM_ERROR",
      "CONNECT_TOKEN_FAILED",
      "UPSTREAM_TIMEOUT",
      "UPSTREAM_NETWORK",
      "UPSTREAM_UNAVAILABLE",
    ].includes(code)
  ) {
    return "unavailable";
  }
  return "unknown";
}
