import type { ConnectionInfo, PortalResponse } from "../../contracts";
import { AddBankAction, addBankAction } from "./connection-journey";

export const WizardStep = {
  authorize: "authorize",
  credentials: "credentials",
  holder: "holder",
  importing: "importing",
  person: "person",
  review: "review",
} as const;
export type WizardStep = (typeof WizardStep)[keyof typeof WizardStep];

// Authorization and import states mean different things to the person.
export const BankPhase = {
  authorized: "authorized",
  failed: "failed",
  importing: "importing",
  partial: "partial",
  succeeded: "succeeded",
} as const;
export type BankPhase = (typeof BankPhase)[keyof typeof BankPhase];

export const ImportOutcome = {
  attention: "attention",
  done: "done",
  partial: "partial",
  running: "running",
  waiting: "waiting",
} as const;
export type ImportOutcome = (typeof ImportOutcome)[keyof typeof ImportOutcome];

export function personProfile(snapshot: PortalResponse, personId: string) {
  const profiles = snapshot.profiles.filter(
    (value) => value.personId === personId,
  );
  return (
    profiles.find((value) => value.configured && value.enabled) ?? profiles[0]
  );
}

// The journey is what this person added since the wizard opened plus anything
// authorized but not yet admitted, which D1 keeps across a reload.
export function journeyConnections({
  baseline,
  personId,
  snapshot,
}: {
  baseline: ReadonlySet<string>;
  personId: string;
  snapshot: PortalResponse;
}) {
  return snapshot.connections.filter(
    (connection) =>
      connection.personId === personId &&
      !(baseline.has(connection.id) && connection.importStatus),
  );
}

export function bankPhase(connection: ConnectionInfo): BankPhase {
  if (connection.importStatus === "failed") {
    return BankPhase.failed;
  }
  if (
    connection.importStatus === "pending" ||
    connection.importStatus === "running"
  ) {
    return BankPhase.importing;
  }
  if (!connection.importStatus) {
    return BankPhase.authorized;
  }
  return connection.partial ? BankPhase.partial : BankPhase.succeeded;
}

export function importOutcome(connections: ConnectionInfo[]): ImportOutcome {
  const phases = connections.map(bankPhase);
  if (phases.includes(BankPhase.importing)) {
    return ImportOutcome.running;
  }
  if (phases.includes(BankPhase.authorized)) {
    return ImportOutcome.waiting;
  }
  if (phases.includes(BankPhase.failed)) {
    return ImportOutcome.attention;
  }
  if (phases.includes(BankPhase.partial)) {
    return ImportOutcome.partial;
  }
  return ImportOutcome.done;
}

// Only unadmitted banks and failures past their eligibility are requested;
// running, completed and older connections are never touched.
export function importableIds({
  connections,
  now,
  snapshot,
}: {
  connections: ConnectionInfo[];
  now: number;
  snapshot: PortalResponse;
}) {
  const ready = new Set(
    snapshot.profiles
      .filter((profile) => profile.enabled && profile.configured)
      .map((profile) => profile.id),
  );
  return connections
    .filter((connection) => {
      if (!ready.has(connection.profileId ?? "default")) {
        return false;
      }
      if (!connection.importStatus) {
        return true;
      }
      return (
        connection.importStatus === "failed" &&
        (!connection.nextEligibleAt ||
          Date.parse(connection.nextEligibleAt) <= now)
      );
    })
    .map((connection) => connection.id)
    .slice(0, 200);
}

// Banks of this person that still need an import: authorized but never
// admitted, or failed. D1 keeps both across reloads.
export function pendingImports(snapshot: PortalResponse, personId: string) {
  return snapshot.connections.filter(
    (connection) =>
      connection.personId === personId &&
      (!connection.importStatus || connection.importStatus === "failed"),
  ).length;
}

// Resuming follows everything that is not settled yet for this person.
export function resumeBaseline(snapshot: PortalResponse) {
  return new Set(
    snapshot.connections
      .filter((connection) => connection.importStatus === "succeeded")
      .map((connection) => connection.id),
  );
}

// The caller has already resolved the person, which may be too new for the snapshot.
export function accessStep(snapshot: PortalResponse, personId: string) {
  const action = addBankAction({
    person: {},
    profile: personProfile(snapshot, personId),
  });
  if (action === AddBankAction.Credentials) {
    return WizardStep.credentials;
  }
  return WizardStep.authorize;
}

export function openingStep(snapshot: PortalResponse) {
  if (!snapshot.people.length) {
    return { personId: null, step: WizardStep.person };
  }
  const [only] = snapshot.people;
  if (snapshot.people.length === 1 && only) {
    return { personId: only.id, step: accessStep(snapshot, only.id) };
  }
  return { personId: null, step: WizardStep.holder };
}

export function backStep({
  created,
  multiple,
  step,
}: {
  created: boolean;
  multiple: boolean;
  step: WizardStep;
}) {
  if (step === WizardStep.credentials) {
    return created || !multiple ? WizardStep.person : WizardStep.holder;
  }
  if (step === WizardStep.authorize) {
    if (created) {
      return WizardStep.person;
    }
    return multiple ? WizardStep.holder : null;
  }
  if (step === WizardStep.person) {
    return multiple ? WizardStep.holder : null;
  }
  return null;
}

export const JourneyStage = {
  authorization: "authorization",
  holder: "holder",
  import: "import",
  result: "result",
} as const;
export type JourneyStage = (typeof JourneyStage)[keyof typeof JourneyStage];

export const journeyStages: { id: JourneyStage; label: string }[] = [
  { id: JourneyStage.holder, label: "Titular" },
  { id: JourneyStage.authorization, label: "Autorização" },
  { id: JourneyStage.import, label: "Importação" },
  { id: JourneyStage.result, label: "Resultado" },
];

export function stageOf(
  step: WizardStep,
  outcome: ImportOutcome,
): JourneyStage {
  if (step === WizardStep.holder || step === WizardStep.person) {
    return JourneyStage.holder;
  }
  if (step !== WizardStep.importing) {
    return JourneyStage.authorization;
  }
  if (outcome === ImportOutcome.done || outcome === ImportOutcome.partial) {
    return JourneyStage.result;
  }
  return JourneyStage.import;
}
