import type { WizardState } from "#contracts/wizard.types.ts";

export interface InstallationChecks {
  database: boolean;
  workflow: boolean;
  oauth: boolean;
  migrations: boolean;
}

export interface AccountResponse {
  status: WizardState;
  checks: InstallationChecks;
  items: { id: string }[];
  latest: { status: string; phase: string; updated_at: string } | null;
  csrf: string;
  origin: string;
  checkedAt: string;
}
