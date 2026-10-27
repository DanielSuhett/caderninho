import {
  type FormEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { HouseholdCommandSchema } from "../../contracts";
import {
  guardWorkspaceNavigation,
  navigateWorkspace,
  workspaceHref,
} from "./account-navigation";
import { AddBankAction, addBankAction } from "./connection-journey";
import type { DashboardProps } from "./dashboard-view";

export const SetupStep = {
  assistant: "assistant",
  credentials: "credentials",
  importing: "import",
  people: "people",
  person: "person",
} as const;
export type SetupStep = (typeof SetupStep)[keyof typeof SetupStep];

export function usePeopleSetup(props: DashboardProps) {
  const { snapshot, manage, connect } = props;
  const params = new URLSearchParams(location.search);
  const requested = params.get("setup");
  const selectedStep =
    Object.values(SetupStep).find((value) => value === requested) ??
    (snapshot.connections.length ? SetupStep.people : SetupStep.person);
  const pending = snapshot.connections.some(
    (connection) =>
      !connection.importStatus ||
      connection.importStatus === "pending" ||
      connection.importStatus === "running",
  );
  const step =
    selectedStep === SetupStep.assistant && pending
      ? SetupStep.importing
      : selectedStep;
  const space = params.get("space") ?? "personal";
  const selectedId = params.get("person") ?? snapshot.people[0]?.id ?? "new";
  const person = snapshot.people.find((value) => value.id === selectedId);
  const profiles = snapshot.profiles.filter(
    (value) => value.personId === selectedId,
  );
  const profile =
    profiles.find((value) => value.configured && value.enabled) ?? profiles[0];
  const connections = snapshot.connections.filter(
    (value) => value.personId === selectedId,
  );
  const [issue, setIssue] = useState("");
  const notice = useRef<HTMLDivElement>(null);
  const draft = useRef<boolean>(false);
  const markDirty = useCallback(() => {
    draft.current = true;
  }, []);
  useEffect(() => {
    const allow = () => {
      if (draft.current || props.busy) {
        setIssue("Salve ou cancele a edição antes de sair.");
        return false;
      }
      return true;
    };
    const leave = (event: BeforeUnloadEvent) => {
      if (draft.current || props.busy) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", leave);
    const release = guardWorkspaceNavigation(allow);
    return () => {
      release();
      window.removeEventListener("beforeunload", leave);
    };
  }, [props.busy]);
  const go = useCallback(
    (next: SetupStep, owner = selectedId) => {
      if (draft.current) {
        setIssue("Salve ou cancele a edição antes de sair.");
        return;
      }
      setIssue("");
      navigateWorkspace(
        new URL(
          workspaceHref("/account/connections?") +
            new URLSearchParams({ person: owner, setup: next, space }),
          location.origin,
        ),
      );
    },
    [selectedId, space],
  );
  const cancelForm = useCallback(() => {
    draft.current = false;
    go(SetupStep.people, person?.id ?? snapshot.people[0]?.id ?? "new");
  }, [go, person?.id, snapshot.people]);
  useEffect(() => {
    if (issue) {
      notice.current?.focus();
      notice.current?.scrollIntoView({ block: "nearest" });
    }
  }, [issue]);
  const savePerson = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      const input = HouseholdCommandSchema.safeParse({
        action: "save_person",
        csrf: snapshot.csrf,
        ...(person && { id: person.id }),
        name: values.get("name"),
        photo: values.get("photo") || null,
      });
      if (!input.success) {
        setIssue("Confira o nome e a foto selecionada. A foto é opcional.");
        return;
      }
      const result = await manage(input.data);
      if (!result.ok) {
        setIssue(result.message);
        return;
      }
      const id = result.id ?? person?.id;
      if (!id) {
        setIssue(
          "Cadastro salvo. Atualize a página para conferir a pessoa antes de continuar.",
        );
        return;
      }
      draft.current = false;
      go(profile?.configured ? SetupStep.people : SetupStep.credentials, id);
    },
    [go, manage, person, profile?.configured, snapshot.csrf],
  );
  const saveCredentials = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!person) {
        go(SetupStep.person);
        return;
      }
      const form = event.currentTarget;
      const values = new FormData(form);
      const input = HouseholdCommandSchema.safeParse({
        action: "save_profile",
        clientId: values.get("clientId"),
        clientSecret: values.get("clientSecret"),
        csrf: snapshot.csrf,
        enabled: true,
        ...(profile && { id: profile.id }),
        name: `Meu Pluggy de ${person.name}`,
        personId: person.id,
      });
      if (!input.success) {
        setIssue(
          "Informe o Client ID e o Client Secret da mesma aplicação Pluggy.",
        );
        return;
      }
      const result = await manage(input.data);
      if (!result.ok) {
        setIssue(result.message);
        return;
      }
      form.reset();
      draft.current = false;
      go(SetupStep.people);
      if (result.id) {
        connect(result.id);
      }
    },
    [connect, go, manage, person, profile, snapshot.csrf],
  );
  const addBank = useCallback(() => {
    const action = addBankAction({ person, profile });
    if (action === AddBankAction.Person) {
      go(SetupStep.person);
      return;
    }
    if (action === AddBankAction.Credentials) {
      go(SetupStep.credentials);
      return;
    }
    if (action === AddBankAction.Paused) {
      setIssue(
        "Este acesso Pluggy está pausado. Reative-o em Ajustes para conectar outro banco.",
      );
      return;
    }
    if (profile) {
      connect(profile.id);
    }
  }, [connect, go, person, profile]);
  const selectPerson = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      go(SetupStep.people, event.currentTarget.value);
    },
    [go],
  );
  const addPerson = useCallback(() => go(SetupStep.person, "new"), [go]);
  const editPerson = useCallback(() => go(SetupStep.person), [go]);
  const finishPeople = useCallback(() => {
    go(pending ? SetupStep.importing : SetupStep.assistant);
  }, [go, pending]);
  return {
    addBank,
    addPerson,
    cancelForm,
    connections,
    editPerson,
    finishPeople,
    go,
    issue,
    markDirty,
    notice,
    person,
    profile,
    saveCredentials,
    savePerson,
    selectedId,
    selectPerson,
    step,
  };
}
