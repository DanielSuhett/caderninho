import { Banner, Input, LayerCard, Loader, Select } from "@cloudflare/kumo";

import { UiButton, UiLink } from "../ui";
import type { ConnectionWizardModel } from "./use-connection-wizard";

export function ConnectionWizardView({
  model,
}: {
  model: ConnectionWizardModel;
}) {
  return (
    <LayerCard
      className="connection-wizard"
      render={<section aria-labelledby="wizard-heading" />}
    >
      <div className="section-heading">
        <h2
          id="wizard-heading"
          key={model.step}
          ref={model.heading}
          tabIndex={-1}
        >
          {model.complete ? "Conexão adicionada" : "Adicionar conexão"}
        </h2>
        <UiButton
          disabled={model.busy}
          onClick={model.close}
          type="button"
          variant="ghost"
        >
          {model.complete ? "Concluir" : "Fechar"}
        </UiButton>
      </div>
      <ol
        aria-label="Etapas da conexão"
        className="connection-steps"
      >
        {["Titular", "Conta Pluggy", "Autorizar banco"].map((label, index) => (
          <li
            aria-current={model.step === index + 1 ? "step" : undefined}
            key={label}
          >
            <span className="connection-step-number">{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      {!!model.issue && (
        <div
          ref={model.feedback}
          tabIndex={-1}
        >
          <Banner
            description={model.issue}
            role="alert"
            variant="error"
          />
        </div>
      )}
      {model.step === 1 && <OwnerStep model={model} />}
      {model.step === 2 && <ProfileStep model={model} />}
      {model.step === 3 && <AuthorizationStep model={model} />}
    </LayerCard>
  );
}

function OwnerStep({ model }: { model: ConnectionWizardModel }) {
  return (
    <form
      className="wizard-form"
      onSubmit={model.chooseOwner}
    >
      <p>
        Escolha de quem são os dados. Você pode incluir outra pessoa aqui mesmo.
      </p>
      <Select
        className="w-full"
        items={model.ownerOptions}
        label="Titular dos dados"
        onValueChange={model.changeOwner}
        value={model.ownerId}
      />
      {model.ownerId === "new" && (
        <Input
          label="Nome da pessoa"
          maxLength={80}
          onChange={model.changeName}
          placeholder="Como você a chama?"
          required
          value={model.ownerName}
        />
      )}
      <p className="muted">
        O nome organiza os dados na visão conjunta. As pessoas desta instalação
        compartilham o mesmo acesso.
      </p>
      <UiButton
        type="submit"
        variant="primary"
      >
        Continuar
      </UiButton>
    </form>
  );
}

function ProfileStep({ model }: { model: ConnectionWizardModel }) {
  return (
    <form
      className="wizard-form"
      onSubmit={model.save}
    >
      <p>
        Dados de <strong>{model.ownerLabel}</strong>. Use uma conta Pluggy
        cadastrada ou informe as credenciais de outra aplicação.
      </p>
      <Select
        className="w-full"
        items={model.profileOptions}
        label="Conta Pluggy"
        onValueChange={model.changeProfile}
        value={model.choice}
      />
      {model.choice === "new" && (
        <>
          <Input
            defaultValue={`Pluggy de ${model.ownerLabel}`}
            label="Nome desta conta Pluggy"
            maxLength={80}
            name="name"
            required
          />
          <div className="editor-grid">
            <Input
              autoComplete="off"
              label="Client ID"
              maxLength={200}
              name="clientId"
              required
            />
            <Input
              autoComplete="new-password"
              label="Client Secret"
              maxLength={512}
              name="clientSecret"
              required
              type="password"
            />
          </div>
          <p className="muted">
            Copie o par de credenciais da mesma aplicação no painel da Pluggy. A
            validação acontece antes de cadastrar a pessoa e a conta. O segredo
            fica somente no servidor.
          </p>
        </>
      )}
      <div className="draft-actions">
        <UiButton
          disabled={model.busy}
          onClick={model.back}
          type="button"
        >
          Voltar
        </UiButton>
        <UiButton
          disabled={model.busy}
          type="submit"
          variant="primary"
        >
          {model.saveLabel}
        </UiButton>
      </div>
    </form>
  );
}

function AuthorizationStep({ model }: { model: ConnectionWizardModel }) {
  return (
    <div className="wizard-form">
      <p>
        <strong>{model.profileLabel}</strong> · {model.ownerLabel}
      </p>
      {model.complete ? (
        <>
          <Banner
            description="A conexão foi registrada. A primeira importação será acompanhada nesta página."
            role="status"
            variant="default"
          />
          <UiLink href={model.connectionHref}>Ver esta conexão</UiLink>
        </>
      ) : (
        <>
          <p>
            Abra o Meu Pluggy, escolha a instituição e autorize a leitura dos
            dados. A conta Pluggy já está salva; você pode retomar esta etapa
            depois.
          </p>
          {!!model.message && (
            <Banner
              description={model.message}
              role="alert"
              variant="error"
            />
          )}
          {model.activity ? (
            <div role="status">
              <Loader
                aria-label="Conectando"
                size="base"
              />
              <p>{model.activityLabel}</p>
              {model.activity.stage !== "registering" && (
                <UiButton
                  onClick={model.cancel}
                  type="button"
                >
                  Fechar janela do Meu Pluggy
                </UiButton>
              )}
            </div>
          ) : (
            <div className="draft-actions">
              {!!model.canBack && (
                <UiButton
                  disabled={model.busy}
                  onClick={model.back}
                  type="button"
                >
                  Voltar
                </UiButton>
              )}
              <UiButton
                disabled={model.busy}
                onClick={model.authorize}
                type="button"
                variant="primary"
              >
                Abrir Meu Pluggy
              </UiButton>
            </div>
          )}
        </>
      )}
    </div>
  );
}
