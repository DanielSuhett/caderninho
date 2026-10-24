import { Banner, Input } from "@cloudflare/kumo";

import type { HouseholdCommand, PortalResponse } from "../../contracts";
import { UiButton, UiCheckbox } from "../ui";
import type { ManagementOutcome } from "./account-feedback";
import { DisclosureItem } from "./disclosure-item";
import {
  type HouseholdEditorModel,
  useHouseholdEditor,
} from "./use-household-editor";
export function HouseholdPanel({
  snapshot,
  busy,
  manage,
}: {
  snapshot: PortalResponse;
  busy: boolean;
  manage: (input: HouseholdCommand) => Promise<ManagementOutcome>;
}) {
  const editor = useHouseholdEditor({ csrf: snapshot.csrf, manage });

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
      <p>
        Edite os nomes ou atualize as credenciais das contas já cadastradas.
        Para incluir outra pessoa e conta Pluggy, use “Adicionar conexão”.
      </p>
      <div className="people-editor">
        {snapshot.people.map((person) => (
          <form
            data-id={person.id}
            key={person.id}
            onSubmit={editor.savePerson}
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
            <HouseholdFeedback
              editor={editor}
              target={person.id}
            />
          </form>
        ))}
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
              onSubmit={editor.saveProfile}
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
              <HouseholdFeedback
                editor={editor}
                target={profile.id}
              />
            </form>
          </DisclosureItem>
        ))}
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

function HouseholdFeedback({
  editor,
  target,
}: {
  editor: HouseholdEditorModel;
  target: string;
}) {
  if (editor.feedback.target !== target || !editor.feedback.message) {
    return null;
  }
  return (
    <div
      ref={editor.notice}
      tabIndex={-1}
    >
      <Banner
        description={editor.feedback.message}
        role={editor.feedback.ok ? "status" : "alert"}
        variant={editor.feedback.ok ? "default" : "error"}
      />
    </div>
  );
}
