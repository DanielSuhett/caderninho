import {
  type FormEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { HouseholdCommandSchema } from "../../contracts";
import {
  accessStep,
  backStep,
  ImportOutcome,
  importableIds,
  importOutcome,
  journeyConnections,
  openingStep,
  personProfile,
  resumeBaseline,
  WizardStep,
} from "./bank-wizard";
import type { DashboardProps } from "./dashboard-view";
import { personFormId } from "./person-editor";

export interface PersonDraft {
  name: string;
  photo: string | null;
}

export type WizardStart =
  | { kind: "bank"; personId?: string }
  | { kind: "person" }
  | { kind: "resume"; personId: string };

function initialState(props: DashboardProps, start: WizardStart) {
  const { snapshot } = props;
  if (start.kind === "person") {
    return { personId: null, step: WizardStep.person };
  }
  if (start.kind === "resume") {
    const journey = journeyConnections({
      baseline: resumeBaseline(snapshot),
      personId: start.personId,
      snapshot,
    });
    const waiting = importOutcome(journey) === ImportOutcome.waiting;
    return {
      personId: start.personId,
      step: waiting ? WizardStep.review : WizardStep.importing,
    };
  }
  if (start.personId) {
    return {
      personId: start.personId,
      step: accessStep(snapshot, start.personId),
    };
  }
  return openingStep(snapshot);
}

export function useBankWizard(props: DashboardProps, start: WizardStart) {
  const { snapshot, connect, manage, command } = props;
  const [initial] = useState(() => initialState(props, start));
  const [step, setStep] = useState<WizardStep>(initial.step);
  const [personId, setPersonId] = useState<string | null>(initial.personId);
  const [selected, setSelected] = useState<string>("");
  const [created, setCreated] = useState(false);
  const [authorizing, setAuthorizing] = useState<number | null>(null);
  const [issue, setIssue] = useState("");
  const [dirty, setDirty] = useState(false);
  // Going back keeps what was typed for a person who is not saved yet.
  const [draft, setDraft] = useState<PersonDraft | null>(null);
  // Connections that existed before this journey began are never part of it.
  const [baseline] = useState(() =>
    start.kind === "resume"
      ? resumeBaseline(snapshot)
      : new Set(snapshot.connections.map((connection) => connection.id)),
  );
  const person = snapshot.people.find((value) => value.id === personId);
  const profile = personId ? personProfile(snapshot, personId) : undefined;
  const journey = useMemo(
    () =>
      personId ? journeyConnections({ baseline, personId, snapshot }) : [],
    [baseline, personId, snapshot],
  );
  const outcome = importOutcome(journey);
  const importable = importableIds({
    connections: journey,
    now: Date.now(),
    snapshot,
  });
  const markDirty = useCallback(() => setDirty(true), []);
  // A new connection for this holder is what proves the authorization landed.
  useEffect(() => {
    if (
      step === WizardStep.authorize &&
      authorizing !== null &&
      !props.activity &&
      journey.length > authorizing
    ) {
      setAuthorizing(null);
      setStep(WizardStep.review);
    }
  }, [authorizing, journey.length, props.activity, step]);
  const select = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    setSelected(event.currentTarget.value);
    setIssue("");
  }, []);
  const continueHolder = useCallback(() => {
    if (!selected) {
      setIssue("Escolha o titular para continuar.");
      return;
    }
    setPersonId(selected);
    setIssue("");
    setStep(accessStep(snapshot, selected));
  }, [selected, snapshot]);
  const otherPerson = useCallback(() => {
    setPersonId(null);
    setCreated(false);
    setIssue("");
    setStep(WizardStep.person);
  }, []);
  const previous = backStep({
    created,
    multiple: snapshot.people.length > 1,
    step,
  });
  const back = useCallback(() => {
    if (!previous) {
      return;
    }
    if (step === WizardStep.person && !created) {
      const form = document.getElementById(personFormId);
      if (form instanceof HTMLFormElement) {
        const values = new FormData(form);
        setDraft({
          name: String(values.get("name") ?? ""),
          photo: String(values.get("photo") ?? "") || null,
        });
      }
    }
    setIssue("");
    setStep(previous);
  }, [created, previous, step]);
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
      // Retrying from here edits this person instead of creating another.
      setDirty(false);
      setDraft(null);
      setIssue("");
      setPersonId(id);
      setCreated(true);
      setStep(accessStep(snapshot, id));
    },
    [manage, person, snapshot],
  );
  const saveCredentials = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!person) {
        setStep(WizardStep.person);
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
      setDirty(false);
      setIssue("");
      setStep(WizardStep.authorize);
      if (result.id) {
        setAuthorizing(journey.length);
        connect(result.id);
      }
    },
    [connect, journey.length, manage, person, profile, snapshot.csrf],
  );
  const authorize = useCallback(() => {
    if (!profile?.configured) {
      setStep(WizardStep.credentials);
      return;
    }
    if (!profile.enabled) {
      setIssue(
        "Este acesso Pluggy está pausado. Reative-o em Ajustes para conectar outro banco.",
      );
      return;
    }
    setIssue("");
    setAuthorizing(journey.length);
    connect(profile.id);
  }, [connect, journey.length, profile]);
  const addAnother = useCallback(() => {
    setIssue("");
    setStep(WizardStep.authorize);
  }, []);
  const importBanks = useCallback(() => {
    setIssue("");
    setStep(WizardStep.importing);
    if (importable.length) {
      command("sync", importable);
      return;
    }
    props.refresh();
  }, [command, importable, props.refresh]);
  return {
    addAnother,
    authorize,
    back,
    canBack: !!previous,
    continueHolder,
    created,
    dirty,
    draft,
    importable,
    importBanks,
    issue,
    journey,
    markDirty,
    otherPerson,
    outcome,
    person,
    profile,
    saveCredentials,
    savePerson,
    select,
    selected,
    step,
  };
}
