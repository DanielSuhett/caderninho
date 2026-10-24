import { Fragment } from "react";

const afterThousandsGroup = /(?<=\.)/u;

// Keep each thousands group and the final decimal/currency together, including
// amounts above the safe integer range. The underlying text remains exact.
export function MoneyValue({ value }: { value: string }) {
  if (!value.includes(".")) {
    return <span className="money-value money-value-whole">{value}</span>;
  }
  let length = 0;
  const groups = value.split(afterThousandsGroup).map((text) => {
    length += text.length;
    return { id: length, text };
  });
  return (
    <span className="money-value">
      {groups.map((group) => (
        <Fragment key={group.id}>
          <span>{group.text}</span>
          <wbr />
        </Fragment>
      ))}
    </span>
  );
}
