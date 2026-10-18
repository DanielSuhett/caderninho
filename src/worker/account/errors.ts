import { WizardIssue } from "#contracts/wizard.types.ts";
import { FaultCode } from "#domain/enums.ts";

const issuesByCode = new Map<string, WizardIssue>([
  [FaultCode.UPSTREAM_AUTH, WizardIssue.credentials],
  [FaultCode.UPSTREAM_FORBIDDEN, WizardIssue.credentials],
  ["PLUGGY_ACCOUNT_NOT_CONFIGURED", WizardIssue.credentials],
  ["APPLICATION_CHANGE_REQUIRES_MIGRATION", WizardIssue.application],
  [FaultCode.UPSTREAM_RATE_LIMIT, WizardIssue.rate],
  ["CONNECT_RATE_LIMIT", WizardIssue.rate],
  ["MEU_PLUGGY_REQUIRED", WizardIssue.connector],
  ["SOURCE_SCOPE_MISMATCH", WizardIssue.item],
  [FaultCode.UPSTREAM_NOT_FOUND, WizardIssue.item],
  ["ITEM_LIMIT", WizardIssue.item],
  [FaultCode.ITEM_NOT_AUTHORIZED, WizardIssue.item],
  [FaultCode.UPSTREAM_ERROR, WizardIssue.unavailable],
  ["CONNECT_TOKEN_FAILED", WizardIssue.unavailable],
  [FaultCode.UPSTREAM_TIMEOUT, WizardIssue.unavailable],
  ["UPSTREAM_NETWORK", WizardIssue.unavailable],
  [FaultCode.UPSTREAM_UNAVAILABLE, WizardIssue.unavailable],
]);

export function wizardIssue(error: Error): WizardIssue {
  const code = "code" in error ? String(error.code) : error.message;
  return issuesByCode.get(code) ?? WizardIssue.unknown;
}
