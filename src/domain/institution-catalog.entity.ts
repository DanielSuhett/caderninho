import type { Institution } from "./financial-identity.entity";

// Brazilian institutions are keyed by COMPE, the bank clearing code that Pluggy
// reports first in `bankData.transferNumber`. The prefix keeps these ids apart
// from provider connector ids.
const INSTITUTION_ID_PREFIX = "compe:";
const compePattern = /^\d{1,3}$/;

export interface InstitutionCatalog {
  find: (compe: string) => Promise<Institution | null>;
  list: () => Promise<Institution[]>;
}

export function normalizeCompe(value: string | null | undefined) {
  const compe = value?.trim() ?? "";
  if (!compePattern.test(compe)) {
    return null;
  }
  return compe.padStart(3, "0");
}

export function compeInstitutionId(compe: string) {
  return `${INSTITUTION_ID_PREFIX}${compe}`;
}

export function compeFromInstitutionId(id: string) {
  if (!id.startsWith(INSTITUTION_ID_PREFIX)) {
    return null;
  }
  return normalizeCompe(id.slice(INSTITUTION_ID_PREFIX.length));
}

// The first segment of "COMPE / Agência / Conta".
export function transferCompe(transferNumber: string | null | undefined) {
  return normalizeCompe(transferNumber?.split("/")[0]);
}

// The distinct bank codes an item reports. One item is one bank, so more than one
// code means the evidence conflicts and the bank must stay unknown.
export function accountCompes(
  accounts: {
    bankData?:
      | { transferNumber?: string | null | undefined }
      | null
      | undefined;
  }[],
) {
  const compes = new Set<string>();
  for (const account of accounts) {
    const compe = transferCompe(account.bankData?.transferNumber);
    if (compe) {
      compes.add(compe);
    }
  }
  return compes;
}

// "COMPE / Agência / Conta" identifies a bank account across items. Without a
// valid COMPE or any segment the account cannot be compared.
export function accountHolderKey(transferNumber: string | null | undefined) {
  const [compe, agency, number] = (transferNumber ?? "")
    .split("/")
    .map((part) => part.replace(/\s+/g, "").toLowerCase());
  const code = normalizeCompe(compe);
  if (!(code && agency && number)) {
    return null;
  }
  return `${code}/${agency}/${number}`;
}

// A connection is a duplicate only when every account it can identify is
// already held by another connection.
export function isDuplicateConnection(
  incoming: string[],
  existing: ReadonlySet<string>,
) {
  return incoming.length > 0 && incoming.every((key) => existing.has(key));
}
