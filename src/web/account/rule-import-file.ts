import {
  RULE_IMPORT_MAX_BYTES,
  RuleImportPackageSchema,
} from "../../contracts";

const bom = /^\uFEFF/;
export function parseRuleImportText(text: string) {
  if (new TextEncoder().encode(text).length > RULE_IMPORT_MAX_BYTES) {
    throw new Error("O arquivo excede o limite de 64 KiB.");
  }
  let value: unknown;
  try {
    value = JSON.parse(text.replace(bom, ""));
  } catch (cause) {
    throw new Error(
      "JSON inválido. Confira vírgulas, aspas e chaves do arquivo.",
      { cause },
    );
  }
  const parsed = RuleImportPackageSchema.safeParse(value);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    throw new Error(
      `Contrato inválido em ${issue?.path.join(".") || "JSON"}: ${issue?.message ?? "confira os campos"}`,
    );
  }
  return parsed.data;
}
export async function readRuleImportFile(file: Pick<File, "size" | "text">) {
  if (file.size > RULE_IMPORT_MAX_BYTES) {
    throw new Error("O arquivo excede o limite de 64 KiB.");
  }
  return parseRuleImportText(await file.text());
}
