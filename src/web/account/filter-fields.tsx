import {
  Combobox,
  type DateRange,
  Input,
  InputGroup,
  Loader,
  Popover,
  Select,
} from "@cloudflare/kumo";
import { CalendarIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import {
  type ChangeEvent,
  type ComponentProps,
  lazy,
  Suspense,
  useCallback,
  useState,
} from "react";

import { UiButton } from "../ui";
import { type AccountAppearance, AccountIdentity } from "./account-identity";
import { type CategoryAppearance, CategoryLabel } from "./category-appearance";

const Calendar = lazy(async () => {
  const { DatePicker } = await import(
    "@cloudflare/kumo/components/date-picker"
  );
  return { default: DatePicker };
});

export function SearchField({
  label,
  ...props
}: ComponentProps<typeof InputGroup.Input> & { label: string }) {
  return (
    <InputGroup label={label}>
      <InputGroup.Addon>
        <MagnifyingGlassIcon
          aria-hidden
          size={16}
        />
      </InputGroup.Addon>
      <InputGroup.Input
        aria-label={label}
        {...props}
        type="search"
      />
    </InputGroup>
  );
}

// A GET search preserves applied scope/filters and starts again without a cursor.
export function QuerySearch({
  action,
  params,
  name,
  label,
  compact = false,
}: {
  action: string;
  params: URLSearchParams;
  name: "text" | "q";
  label: string;
  compact?: boolean;
}) {
  return (
    <form
      action={action}
      className="query-search"
      data-compact={compact}
      method="get"
    >
      {[...params.entries()]
        .filter(([key]) => key !== name && key !== "cursor")
        .map(([key, value]) => (
          <input
            key={key}
            name={key}
            type="hidden"
            value={value}
          />
        ))}
      {compact ? (
        <InputGroup>
          <InputGroup.Input
            aria-label={label}
            defaultValue={params.get(name) ?? ""}
            enterKeyHint="search"
            maxLength={240}
            name={name}
            placeholder={label}
            type="search"
          />
          <InputGroup.Addon align="end">
            <InputGroup.Button
              icon={MagnifyingGlassIcon}
              tooltip="Buscar"
              type="submit"
            />
          </InputGroup.Addon>
        </InputGroup>
      ) : (
        <>
          <SearchField
            defaultValue={params.get(name) ?? ""}
            label={label}
            maxLength={240}
            name={name}
            placeholder="Ex.: mercado"
          />
          <UiButton
            type="submit"
            variant="secondary"
          >
            Buscar
          </UiButton>
        </>
      )}
    </form>
  );
}

interface CatalogOption {
  account?: AccountAppearance;
  appearance?: CategoryAppearance;
  label: string;
  owner?: import("../../domain").Person | undefined;
  value: string;
}

export function AccountFilter({
  accounts,
  value,
  showOwner = false,
}: {
  accounts: Array<
    AccountAppearance & { id: string; personId?: string; personName?: string }
  >;
  value: string;
  showOwner?: boolean;
}) {
  if (accounts.length < 2) {
    return (
      <input
        name="accountId"
        type="hidden"
        value={value}
      />
    );
  }
  const items = [
    { label: "Todas as contas", value: "" },
    ...accounts.map((account) => ({
      account,
      label: account.name,
      owner:
        showOwner && account.personId && account.personName
          ? { id: account.personId, name: account.personName }
          : undefined,
      value: account.id,
    })),
  ];
  if (accounts.length <= 8) {
    return (
      <Select
        className="w-full"
        defaultValue={value}
        items={items.map((item) => ({
          label:
            "account" in item ? (
              <AccountIdentity
                account={item.account}
                person={item.owner}
              />
            ) : (
              item.label
            ),
          value: item.value,
        }))}
        label="Conta"
        name="accountId"
      />
    );
  }
  return (
    <CatalogField
      defaultValue={value}
      items={items}
      label="Conta"
      name="accountId"
    />
  );
}
function optionLabel(item: CatalogOption) {
  return item.label;
}
function optionValue(item: CatalogOption) {
  return item.value;
}
function renderOption(item: CatalogOption) {
  return (
    <Combobox.Item
      key={item.value}
      value={item}
    >
      {!!item.account && (
        <AccountIdentity
          account={item.account}
          person={item.owner}
        />
      )}
      {!item.account &&
        (item.appearance ? (
          <CategoryLabel
            category={item.appearance}
            label={item.label}
          />
        ) : (
          item.label
        ))}
    </Combobox.Item>
  );
}

export function CatalogField({
  label,
  name,
  defaultValue,
  items,
}: {
  label: string;
  name: string;
  defaultValue: string;
  items: CatalogOption[];
}) {
  return (
    <Combobox
      defaultValue={items.find((item) => item.value === defaultValue) ?? null}
      items={items}
      itemToStringLabel={optionLabel}
      itemToStringValue={optionValue}
      label={label}
      name={name}
    >
      <Combobox.TriggerInput
        clearLabel="Limpar seleção"
        placeholder="Selecione ou busque"
        showOptionsLabel="Mostrar opções"
      />
      <Combobox.Content>
        <Combobox.Empty>Nenhuma opção encontrada.</Combobox.Empty>
        <Combobox.List>{renderOption}</Combobox.List>
      </Combobox.Content>
    </Combobox>
  );
}

const calendarDayPattern = /^\d{4}-\d{2}-\d{2}$/;
function calendarDay(value: string) {
  if (!calendarDayPattern.test(value)) {
    return;
  }
  const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}
function inputDay(value: Date | undefined) {
  if (!value) {
    return "";
  }
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
const formatters = {
  formatCaption: (date: Date) =>
    date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
  formatWeekdayName: (date: Date) =>
    date.toLocaleDateString("pt-BR", { weekday: "short" }),
};
const calendarLabels = {
  labelDayButton: (date: Date) =>
    date.toLocaleDateString("pt-BR", { dateStyle: "full" }),
  labelGrid: (date: Date) =>
    date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
  labelNav: () => "Navegação do calendário",
  labelNext: () => "Próximo mês",
  labelPrevious: () => "Mês anterior",
};

// Dates are civil dates from the provider; no UTC conversion or invented timezone.
export function DateRangeFields({
  from: initialFrom,
  to: initialTo,
}: {
  from: string;
  to: string;
}) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const onFrom = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setFrom(event.currentTarget.value),
    [],
  );
  const onTo = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setTo(event.currentTarget.value),
    [],
  );
  const onRange = useCallback((range: DateRange | undefined) => {
    setFrom(inputDay(range?.from));
    setTo(inputDay(range?.to));
  }, []);
  return (
    <div className="date-range-fields">
      <div className="editor-grid">
        <Input
          label="De"
          name="from"
          onChange={onFrom}
          type="date"
          value={from}
        />
        <Input
          label="Até"
          name="to"
          onChange={onTo}
          type="date"
          value={to}
        />
      </div>
      <Popover>
        <Popover.Trigger
          render={
            <UiButton
              type="button"
              variant="secondary"
            />
          }
        >
          <CalendarIcon
            aria-hidden
            size={16}
          />
          Escolher no calendário
        </Popover.Trigger>
        <Popover.Content className="transaction-calendar">
          <Popover.Title>Período das transações</Popover.Title>
          <Suspense fallback={<Loader aria-label="Carregando calendário" />}>
            <Calendar
              formatters={formatters}
              labels={calendarLabels}
              mode="range"
              numberOfMonths={1}
              onChange={onRange}
              selected={{ from: calendarDay(from), to: calendarDay(to) }}
            />
          </Suspense>
          <p>
            Datas conforme a origem. Digite nos campos para usar somente um
            limite.
          </p>
        </Popover.Content>
      </Popover>
    </div>
  );
}
