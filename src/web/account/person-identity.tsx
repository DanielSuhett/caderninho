import { Tooltip } from "@cloudflare/kumo/components/tooltip";
import { PlusIcon } from "@phosphor-icons/react";
import {
  createContext,
  type MouseEvent,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import type { Person } from "../../domain";
import { UiButton } from "../ui";

export const PersonDirectory = createContext<Person[]>([]);

const nameSeparator = /\s+/;

export function personInitials(name: string) {
  const words = name.trim().split(nameSeparator);
  const first = Array.from(words[0] ?? "")[0] ?? "?";
  const last =
    words.length > 1 ? (Array.from(words.at(-1) ?? "")[0] ?? "") : "";
  return `${first}${last}`.toLocaleUpperCase("pt-BR");
}

function personColor(id: string) {
  let colorSeed = 0;
  for (const character of id) {
    colorSeed = (colorSeed * 31 + character.charCodeAt(0)) % 1_000_000_007;
  }
  return `oklch(42% 0.13 ${colorSeed % 360})`;
}

export function PersonAvatar({
  person,
  size = 32,
}: {
  person: Person;
  size?: 24 | 32 | 64;
}) {
  const people = useContext(PersonDirectory);
  const photo =
    person.photo === undefined
      ? people.find((p) => p.id === person.id)?.photo
      : person.photo;
  const [failed, setFailed] = useState<string | null>(null);
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const element = image.current;
    if (!(element && photo)) {
      return;
    }
    const fail = () => setFailed(photo);
    element.addEventListener("error", fail);
    if (element.complete && element.naturalWidth === 0) {
      fail();
    }
    return () => element.removeEventListener("error", fail);
  }, [photo]);
  return (
    <span
      aria-hidden="true"
      className="person-avatar"
      style={{
        backgroundColor: personColor(person.id),
        fontSize: { 24: 12, 32: 14, 64: 28 }[size],
        height: size,
        width: size,
      }}
    >
      {photo && failed !== photo ? (
        <img
          alt=""
          height={size}
          ref={image}
          referrerPolicy="no-referrer"
          src={photo}
          width={size}
        />
      ) : (
        personInitials(person.name)
      )}
    </span>
  );
}

export function PersonIdentity({
  person,
  compact = false,
}: {
  person: Person;
  compact?: boolean;
}) {
  return (
    <span className="person-identity">
      <PersonAvatar
        person={person}
        size={compact ? 24 : 32}
      />
      <span>{person.name}</span>
    </span>
  );
}

export function PersonStack({
  people,
  personId = "",
}: {
  people: Person[];
  personId?: string;
}) {
  const selected = personId
    ? people.filter((person) => person.id === personId)
    : people;
  if (!selected.length) {
    return null;
  }
  return (
    <span
      aria-hidden="true"
      className="person-stack"
    >
      {selected.slice(0, 3).map((person) => (
        <PersonAvatar
          key={person.id}
          person={person}
        />
      ))}
      {selected.length > 3 && (
        <span className="person-stack-count">+{selected.length - 3}</span>
      )}
    </span>
  );
}

export function PersonPicker({
  people,
  value,
  onChange,
}: {
  people: Person[];
  value: string;
  onChange: (value: string) => void;
}) {
  const choose = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      onChange(event.currentTarget.value);
    },
    [onChange],
  );
  return (
    <div className="person-selection">
      <fieldset
        aria-label="Titular dos dados"
        className="person-picker"
      >
        {people.map((person) => (
          <Tooltip
            content={person.name}
            key={person.id}
            render={
              <UiButton
                aria-label={person.name}
                aria-pressed={value === person.id}
                className="person-choice"
                onClick={choose}
                type="button"
                value={person.id}
                variant="ghost"
              >
                <PersonAvatar person={person} />
              </UiButton>
            }
          />
        ))}
        <Tooltip
          content="Outra pessoa"
          render={
            <UiButton
              aria-label="Outra pessoa"
              aria-pressed={value === "new"}
              className="person-choice"
              onClick={choose}
              type="button"
              value="new"
              variant="ghost"
            >
              <PlusIcon
                aria-hidden
                size={20}
              />
            </UiButton>
          }
        />
      </fieldset>
      <p
        aria-live="polite"
        className="person-selection-name"
      >
        {value === "new"
          ? "Outra pessoa"
          : people.find((person) => person.id === value)?.name}
      </p>
    </div>
  );
}
