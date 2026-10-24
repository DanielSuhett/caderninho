const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export function monthPeriod(month: string) {
  const end = new Date(`${month}-01T12:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);
  return { from: `${month}-01`, to: end.toISOString().slice(0, 10) };
}
export function shiftMonth(month: string, distance: number) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + distance);
  return date.toISOString().slice(0, 7);
}
export function selectedMonth(value: string | null, referenceDay: string) {
  return value &&
    monthPattern.test(value) &&
    value >= "0001-01" &&
    value <= "9998-12"
    ? value
    : referenceDay.slice(0, 7);
}
export function monthLabel(month: string) {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString("pt-BR", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  });
}
