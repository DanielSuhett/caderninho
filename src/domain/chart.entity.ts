const xmlCharacters = /[&<>"']/g;
const entities: Record<string, string> = {
  "'": "&apos;",
  '"': "&quot;",
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};
function escapeXml(value: string) {
  return value.replace(xmlCharacters, (char) => entities[char] ?? "");
}
const palette = ["#2563eb", "#0f766e", "#b45309", "#be123c", "#7c3aed"];
export function financialCharts(input: {
  type: "bar" | "line" | "doughnut";
  groups: {
    currency: string;
    group: string;
    amountMinor: string;
    label?: string;
    formattedAmount?: string;
  }[];
}) {
  const currencies = [...new Set(input.groups.map((row) => row.currency))];
  return currencies.map((currency) => {
    const rows = input.groups
      .filter((row) => row.currency === currency)
      .sort((a, b) => a.group.localeCompare(b.group));
    if (rows.length > 60) {
      throw new Error("CHART_TOO_LARGE");
    }
    const magnitudes = rows.map((row) => {
      const value = BigInt(row.amountMinor);
      return value < 0n ? -value : value;
    });
    const maximum = magnitudes.reduce(
      (max, value) => (value > max ? value : max),
      1n,
    );
    const total = magnitudes.reduce((sum, value) => sum + value, 0n);
    let cumulative = 0;
    const points: string[] = [];
    const spacing = rows.length > 1 ? 760 / (rows.length - 1) : 0;
    const shapes = rows
      .map((row, index) => {
        const amount = BigInt(row.amountMinor);
        const magnitude = magnitudes[index] ?? 0n;
        const width = Number.parseInt(
          ((magnitude * 400n) / maximum).toString(),
          10,
        );
        const y = 60 + index * 28;
        const label = `${escapeXml(row.label ?? row.group)}: ${escapeXml(row.formattedAmount ?? `${row.amountMinor} ${currency} minor`)}`;
        const color = palette[index % palette.length] ?? "#2563eb";
        if (input.type === "doughnut") {
          const share = ringShare(amount, magnitude, total);
          const shape = `<circle cx="160" cy="160" r="100" pathLength="100" fill="none" stroke="${color}" stroke-width="40" stroke-dasharray="${share} ${100 - share}" stroke-dashoffset="${-cumulative}" transform="rotate(-90 160 160)"><title>${label}</title></circle><text x="310" y="${y}" fill="${color}">${label}</text>`;
          cumulative += share;
          return shape;
        }
        if (input.type === "line") {
          points.push(
            `${60 + index * spacing},${210 - (amount < 0n ? -width : width) / 2}`,
          );
          return `<text x="60" y="${430 + index * 20}">${label}</text>`;
        }
        const x = amount < 0n ? 440 - width : 440;
        return `<rect x="${x}" y="${y}" width="${width}" height="18" fill="${color}"><title>${label}</title></rect><text x="10" y="${y + 14}">${label}</text>`;
      })
      .join("");
    const height = Math.max(
      350,
      rows.length * 28 + 80,
      input.type === "line" ? rows.length * 20 + 460 : 0,
    );
    const line =
      input.type === "line"
        ? `<polyline points="${points.join(" ")}" fill="none" stroke="#2563eb" stroke-width="3"/>`
        : "";
    return {
      currency,
      mimeType: "image/svg+xml",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 ${height}" role="img" aria-label="${escapeXml(currency)}"><rect width="900" height="${height}" fill="white"/><g font-family="sans-serif" font-size="12" fill="#111827"><text x="10" y="25">${escapeXml(currency)} · minor units · ${input.type}</text>${line}${shapes}</g></svg>`,
    };
  });
}

function ringShare(amount: bigint, magnitude: bigint, total: bigint) {
  if (amount < 0n) {
    throw new Error("CHART_NEGATIVE_VALUES");
  }
  return total
    ? Number.parseInt(((magnitude * 100000n) / total).toString(), 10) / 1000
    : 0;
}
