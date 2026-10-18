import {
  CorrectionField,
  type CorrectionInput,
  type RecordChange,
} from "#domain/record-correction.types.ts";

export function recordChange(input: CorrectionInput): RecordChange {
  if (input.field === CorrectionField.tag) {
    if (input.key === undefined) {
      throw new Error("TAG_KEY_REQUIRED");
    }
    return {
      field: CorrectionField.tag,
      key: input.key,
      value: input.value,
    };
  }

  if (
    input.field === CorrectionField.ignored &&
    input.value !== null &&
    !["0", "1"].includes(input.value)
  ) {
    throw new Error("ignored requires 0 or 1");
  }

  return { field: input.field, value: input.value };
}
