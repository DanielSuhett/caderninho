import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { type HouseholdCommand, HouseholdCommandSchema } from "../../contracts";
import type { ManagementOutcome } from "./account-feedback";

export function useHouseholdEditor({
  csrf,
  manage,
}: {
  csrf: string;
  manage: (input: HouseholdCommand) => Promise<ManagementOutcome>;
}) {
  const [feedback, setFeedback] = useState({
    message: "",
    ok: false,
    target: "",
  });
  const notice = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (feedback.message) {
      notice.current?.focus();
      notice.current?.scrollIntoView({ block: "nearest" });
    }
  }, [feedback]);
  const submit = useCallback(
    async (value: unknown, target: string) => {
      const result = HouseholdCommandSchema.safeParse(value);
      if (!result.success) {
        setFeedback({
          message:
            "Preencha o nome e informe Client ID e Client Secret juntos para alterar credenciais.",
          ok: false,
          target,
        });
        return false;
      }
      setFeedback({ message: "Validando e salvando…", ok: true, target });
      const outcome = await manage(result.data);
      setFeedback({
        message: outcome.ok ? "Alteração salva." : outcome.message,
        ok: outcome.ok,
        target,
      });
      return outcome.ok;
    },
    [manage],
  );
  const saveProfile = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = new FormData(form);
      const input = {
        action: "save_profile",
        csrf,
        ...(form.dataset.id && { id: form.dataset.id }),
        enabled: values.get("enabled") === "on",
        name: values.get("name"),
        personId: values.get("personId"),
        ...(values.get("clientId") && { clientId: values.get("clientId") }),
        ...(values.get("clientSecret") && {
          clientSecret: values.get("clientSecret"),
        }),
      };
      if (await submit(input, form.dataset.id ?? "profile")) {
        for (const name of ["clientId", "clientSecret"]) {
          const field = form.querySelector<HTMLInputElement>(
            `input[name="${name}"]`,
          );
          if (field) {
            field.value = "";
          }
        }
      }
    },
    [csrf, submit],
  );

  return { feedback, notice, saveProfile };
}

export type HouseholdEditorModel = ReturnType<typeof useHouseholdEditor>;
