import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  type HouseholdCommand,
  HouseholdCommandSchema,
  type PortalResponse,
} from "../../contracts";
import type { ManagementOutcome } from "./account-feedback";
import type { ConnectionActivity } from "./connection-journey";

export interface ConnectionWizardProps {
  activity: ConnectionActivity | null;
  busy: boolean;
  cancel: () => void;
  close: () => void;
  connect: (profileId: string) => void;
  manage: (input: HouseholdCommand) => Promise<ManagementOutcome>;
  message: string;
  personId: string;
  snapshot: PortalResponse;
}

const activityLabels = {
  opening: "Abrindo Meu Pluggy…",
  registering: "Registrando a conexão…",
  widget: "Conclua a autorização na janela do Meu Pluggy.",
};

export function useConnectionWizard(props: ConnectionWizardProps) {
  const { snapshot, busy, manage, connect } = props;
  const [step, setStep] = useState(1);
  const [ownerId, setOwnerId] = useState(
    snapshot.people.find((p) => p.id === props.personId)?.id ??
      snapshot.people[0]?.id ??
      "new",
  );
  const [ownerName, setOwnerName] = useState("");
  const [choice, setChoice] = useState("new");
  const [profileId, setProfileId] = useState("");
  const [created, setCreated] = useState(false);
  const [issue, setIssue] = useState("");
  const heading = useCallback((node: HTMLHeadingElement | null) => {
    node?.focus();
    node?.scrollIntoView({ block: "nearest" });
  }, []);
  const feedback = useRef<HTMLDivElement>(null);
  const initialConnections = useRef(
    new Set(snapshot.connections.map((c) => c.id)),
  );
  const person = snapshot.people.find((p) => p.id === ownerId);
  const profiles = snapshot.profiles.filter(
    (p) => p.personId === ownerId && p.enabled && p.configured,
  );
  const selected = snapshot.profiles.find((p) => p.id === profileId);
  const added = snapshot.connections.find(
    (c) => c.profileId === profileId && !initialConnections.current.has(c.id),
  );
  useEffect(() => {
    if (issue) {
      feedback.current?.focus();
      feedback.current?.scrollIntoView({ block: "nearest" });
    }
  }, [issue]);
  const changeOwner = useCallback(
    (value: string | null) => setOwnerId(value ?? "new"),
    [],
  );
  const changeName = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setOwnerName(event.target.value),
    [],
  );
  const changeProfile = useCallback((value: string | null) => {
    setChoice(value ?? "new");
    setIssue("");
  }, []);
  const chooseOwner = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (ownerId === "new" && !ownerName.trim()) {
        setIssue("Informe o nome da pessoa para continuar.");
        return;
      }
      setIssue("");
      setChoice(profiles[0]?.id ?? "new");
      setStep(2);
    },
    [ownerId, ownerName, profiles],
  );
  const save = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIssue("");
      if (choice !== "new") {
        setProfileId(choice);
        setStep(3);
        return;
      }
      const form = event.currentTarget;
      const values = new FormData(form);
      const input = HouseholdCommandSchema.safeParse({
        action: "create_profile",
        clientId: values.get("clientId"),
        clientSecret: values.get("clientSecret"),
        csrf: snapshot.csrf,
        name: values.get("name"),
        person: ownerId === "new" ? { name: ownerName } : { id: ownerId },
      });
      if (!input.success) {
        setIssue(
          "Preencha o nome, o Client ID e o Client Secret para continuar.",
        );
        return;
      }
      const result = await manage(input.data);
      if (!result.ok) {
        setIssue(result.message);
        return;
      }
      if (!result.id) {
        setIssue(
          "A conta foi salva, mas não foi possível identificar o cadastro. Atualize a página antes de continuar.",
        );
        return;
      }
      form.reset();
      setProfileId(result.id);
      setCreated(true);
      setStep(3);
    },
    [choice, manage, ownerId, ownerName, snapshot.csrf],
  );
  const back = useCallback(() => {
    setIssue("");
    setStep((previous) => previous - 1);
  }, []);
  const authorize = useCallback(() => connect(profileId), [connect, profileId]);
  let saveLabel = choice === "new" ? "Validar e continuar" : "Continuar";
  if (busy) {
    saveLabel = "Validando credenciais…";
  }
  return {
    activity: props.activity,
    activityLabel: props.activity ? activityLabels[props.activity.stage] : "",
    authorize,
    back,
    busy,
    canBack: !created,
    cancel: props.cancel,
    changeName,
    changeOwner,
    changeProfile,
    choice,
    chooseOwner,
    close: props.close,
    complete: !!added,
    connectionHref: added
      ? `/account/connections?${new URLSearchParams({ person: added.personId ?? ownerId })}`
      : "",
    feedback,
    heading,
    issue,
    message: props.message,
    ownerId,
    ownerLabel: person?.name ?? ownerName,
    ownerName,
    ownerOptions: [
      ...snapshot.people.map((p) => ({ label: p.name, value: p.id })),
      { label: "Adicionar outra pessoa", value: "new" },
    ],
    profileLabel: selected?.name ?? "Conta Pluggy validada",
    profileOptions: [
      ...profiles.map((p) => ({ label: p.name, value: p.id })),
      { label: "Adicionar outra conta Pluggy", value: "new" },
    ],
    save,
    saveLabel,
    step,
  };
}

export type ConnectionWizardModel = ReturnType<typeof useConnectionWizard>;
