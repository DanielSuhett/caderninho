import { Input, Select } from "@cloudflare/kumo";
import { type FormEvent, useCallback, useState } from "react";

import {
  type HouseholdCommand,
  HouseholdCommandSchema,
  type PortalResponse,
} from "../../contracts";
import { UiButton, UiCheckbox } from "../ui";
import { DisclosureItem } from "./disclosure-item";
export function HouseholdPanel({
  snapshot,
  busy,
  manage,
}: {
  snapshot: PortalResponse;
  busy: boolean;
  manage: (input: HouseholdCommand) => void;
}) {
  const [issue, setIssue] = useState("");
  const submit = useCallback(
    (value: unknown) => {
      const result = HouseholdCommandSchema.safeParse(value);
      if (!result.success) {
        setIssue(
          "Preencha o nome e informe Client ID e Client Secret juntos para alterar credenciais.",
        );
        return false;
      }
      setIssue("");
      manage(result.data);
      return true;
    },
    [manage],
  );
  const savePerson = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = new FormData(form);
      if (
        submit({
          action: "save_person",
          csrf: snapshot.csrf,
          name: values.get("name"),
          ...(form.dataset.id && { id: form.dataset.id }),
        }) &&
        !form.dataset.id
      ) {
        form.reset();
      }
    },
    [snapshot.csrf, submit],
  );
  const saveProfile = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = new FormData(form);
      const input = {
        action: "save_profile",
        csrf: snapshot.csrf,
        ...(form.dataset.id && { id: form.dataset.id }),
        enabled: values.get("enabled") === "on",
        name: values.get("name"),
        personId: values.get("personId"),
        ...(values.get("clientId") && { clientId: values.get("clientId") }),
        ...(values.get("clientSecret") && {
          clientSecret: values.get("clientSecret"),
        }),
      };
      if (submit(input)) {
        form.reset();
      }
    },
    [snapshot.csrf, submit],
  );

  return (
    <section
      aria-labelledby="household-heading"
      className="household-panel"
    >
      <div className="section-heading">
        <div>
          <h2
            id="household-heading"
            tabIndex={-1}
          >
            Pessoas e perfis Pluggy
          </h2>
        </div>
      </div>
      <p>Pessoa é o titular. Perfil identifica a aplicação Pluggy.</p>
      <p role="alert">{issue}</p>
      <div className="people-editor">
        {snapshot.people.map((person) => (
          <form
            data-id={person.id}
            key={person.id}
            onSubmit={savePerson}
          >
            <div className="inline-fields">
              <Input
                defaultValue={person.name}
                id={`person-${person.id}`}
                label="Nome da pessoa"
                maxLength={80}
                name="name"
                required
              />
              <UiButton
                disabled={busy}
                type="submit"
              >
                Salvar nome
              </UiButton>
            </div>
          </form>
        ))}
        <form onSubmit={savePerson}>
          <div className="inline-fields">
            <Input
              id="new-person"
              label="Adicionar pessoa"
              maxLength={80}
              name="name"
              placeholder="Como você a chama?"
              required
            />
            <UiButton
              disabled={busy}
              type="submit"
            >
              Adicionar pessoa
            </UiButton>
          </div>
        </form>
      </div>
      <div className="profile-grid">
        {snapshot.profiles.map((profile) => (
          <DisclosureItem
            className="profile-editor"
            key={profile.id}
            summary={
              <>
                <strong>{profile.name}</strong>
                <span className="muted">
                  {snapshot.people.find((p) => p.id === profile.personId)?.name}{" "}
                  · {profile.connectionCount}{" "}
                  {profile.connectionCount === 1 ? "conexão" : "conexões"} ·{" "}
                  {profileLabel(profile)}
                </span>
              </>
            }
          >
            <form
              data-id={profile.id}
              onSubmit={saveProfile}
            >
              <input
                name="personId"
                type="hidden"
                value={profile.personId}
              />

              <Input
                defaultValue={profile.name}
                id={`profile-name-${profile.id}`}
                label="Nome do perfil"
                maxLength={80}
                name="name"
                required
              />
              <div className="checkbox-label">
                <UiCheckbox
                  defaultChecked={profile.enabled}
                  label="Permitir novas conexões e importações"
                  name="enabled"
                />
              </div>
              <p className="muted">
                Para trocar o segredo, preencha os dois campos. Outra aplicação
                exige um novo perfil.
              </p>
              <CredentialFields
                required={false}
                suffix={profile.id}
              />
              <UiButton
                disabled={busy}
                type="submit"
              >
                Salvar perfil
              </UiButton>
            </form>
          </DisclosureItem>
        ))}
        <DisclosureItem
          className="profile-editor add-profile"
          summary={
            <>
              Adicionar perfil Pluggy
              <span className="muted">
                Conecte outra origem ou outra pessoa
              </span>
            </>
          }
        >
          <form onSubmit={saveProfile}>
            <Input
              id="profile-name-new"
              label="Nome do perfil"
              maxLength={80}
              name="name"
              placeholder="Ex.: Pluggy da Ana"
              required
            />

            <Select
              className="w-full"
              defaultValue={snapshot.people[0]?.id ?? ""}
              id="profile-person-new"
              items={[
                ...snapshot.people.map((p) => ({ label: p.name, value: p.id })),
              ]}
              label="Titular padrão"
              name="personId"
            />
            <input
              name="enabled"
              type="hidden"
              value="on"
            />
            <CredentialFields
              required
              suffix="new"
            />
            <p className="muted">
              As credenciais são verificadas e guardadas somente no servidor.
              Não serão exibidas de volta.
            </p>
            <UiButton
              disabled={busy}
              type="submit"
            >
              Validar e adicionar perfil
            </UiButton>
          </form>
        </DisclosureItem>
      </div>
      <p className="muted">
        O Meu Pluggy gratuito permite até cinco conexões por titular. Adicionar
        um perfil aqui não altera o limite do provedor. Pessoas cadastradas
        compartilham o acesso desta instalação.
      </p>
    </section>
  );
}
function CredentialFields({
  suffix,
  required,
}: {
  suffix: string;
  required: boolean;
}) {
  return (
    <>
      <Input
        autoComplete="off"
        id={`client-${suffix}`}
        label="Client ID"
        maxLength={200}
        name="clientId"
        required={required}
      />

      <Input
        autoComplete="new-password"
        id={`secret-${suffix}`}
        label="Client Secret"
        maxLength={512}
        name="clientSecret"
        required={required}
        type="password"
      />
    </>
  );
}

function profileLabel(profile: { enabled: boolean; configured: boolean }) {
  if (!profile.enabled) {
    return "Pausado";
  }
  return profile.configured
    ? "Pronto para conectar"
    : "Configure as credenciais";
}
