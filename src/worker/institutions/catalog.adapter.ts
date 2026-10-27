import {
  compeInstitutionId,
  type Institution,
  type InstitutionCatalog,
  normalizeCompe,
} from "../../domain";
import { tryCatch } from "../../shared";

// The package data (~250 KB) is imported on first use, so routes that never
// touch institutions neither parse nor keep it. The slim index is built once per
// isolate and shared by every later lookup.
async function load() {
  const { default: data } = await import("logos-bancos-br/data/bancos.json");
  const byCompe = new Map<string, Institution>();
  for (const bank of data.banks) {
    const compe = normalizeCompe(bank.compe);
    if (!compe) {
      continue;
    }
    byCompe.set(compe, {
      id: compeInstitutionId(compe),
      logoUrl: bank.logo?.svg ? `/bancos/${compe}.svg` : null,
      name: bank.displayName ?? bank.shortName ?? bank.name,
    });
  }
  const sorted = [...byCompe.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
  return { byCompe, sorted };
}

export function createInstitutionCatalog(): InstitutionCatalog {
  let loading: ReturnType<typeof load> | undefined;
  const index = async () => {
    loading ??= load();
    const { data, error } = await tryCatch(loading);
    if (error) {
      // A failed import must not poison later requests in this isolate.
      loading = undefined;
      throw error;
    }
    return data;
  };
  return {
    async find(compe) {
      const key = normalizeCompe(compe);
      if (!key) {
        return null;
      }
      return (await index()).byCompe.get(key) ?? null;
    },
    async list() {
      return (await index()).sorted;
    },
  };
}
