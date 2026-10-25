import { Banner, Input } from "@cloudflare/kumo";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from "react";

import type { Person } from "../../domain";
import { tryCatch } from "../../shared";
import { UiButton } from "../ui";
import { PersonAvatar } from "./person-identity";
import { preparePersonPhoto } from "./person-photo";

export function PersonEditor({
  person,
  busy,
  onSubmit,
  children,
}: {
  person: Person;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  children?: ReactNode;
}) {
  const [photo, setPhoto] = useState(person.photo ?? null);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const choose = useCallback(() => input.current?.click(), []);
  const remove = useCallback(() => {
    setPhoto(null);
    setErrorMessage("");
  }, []);
  const changePhoto = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (!file) {
        return;
      }
      setProcessing(true);
      setErrorMessage("");
      const { data, error } = await tryCatch(() => preparePersonPhoto(file));
      setProcessing(false);
      if (error) {
        setErrorMessage(
          "Não foi possível abrir a foto. Use JPEG, PNG ou WebP de até 5 MB.",
        );
        return;
      }
      setPhoto(data);
    },
    [],
  );
  return (
    <form
      data-id={person.id}
      onSubmit={onSubmit}
    >
      <fieldset
        className="person-editor-fields"
        disabled={busy || processing}
      >
        <legend className="sr-only">Perfil de {person.name}</legend>
        <div className="person-photo-controls">
          <PersonAvatar
            person={{ ...person, photo }}
            size={64}
          />
          <input
            accept="image/jpeg,image/png,image/webp"
            aria-label={`Selecionar foto de ${person.name}`}
            hidden
            onChange={changePhoto}
            ref={input}
            type="file"
          />
          <input
            name="photo"
            type="hidden"
            value={photo ?? ""}
          />
          <UiButton
            onClick={choose}
            type="button"
            variant="secondary"
          >
            {photo ? "Trocar foto" : "Adicionar foto"}
          </UiButton>
          {!!photo && (
            <UiButton
              onClick={remove}
              type="button"
              variant="ghost"
            >
              Remover foto
            </UiButton>
          )}
        </div>
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
            disabled={busy || processing}
            type="submit"
          >
            {processing ? "Preparando foto…" : "Salvar pessoa"}
          </UiButton>
        </div>
      </fieldset>
      {!!errorMessage && (
        <Banner
          description={errorMessage}
          role="alert"
          variant="error"
        />
      )}
      {children}
    </form>
  );
}
