import { type AuditReport, ToolName } from "../contracts";

// Synthetic MCP activity so the public demo shows a living observability page.
// Deterministic per day: the same period always renders the same numbers.
const clients = [
  {
    clientId: "demo-claude",
    clientName: "Claude",
    createdDay: 52,
    model: "claude-opus-5-5",
    scope: ["finance:read", "finance:sync"],
    share: 0.58,
  },
  {
    clientId: "demo-chatgpt",
    clientName: "ChatGPT",
    createdDay: 31,
    model: "gpt-5",
    scope: ["finance:read"],
    share: 0.42,
  },
] as const;
const toolMix = [
  { share: 0.46, tool: ToolName.transactions },
  { share: 0.31, tool: ToolName.aggregate },
  { share: 0.17, tool: ToolName.status },
  { share: 0.06, tool: ToolName.sync },
] as const;
const dayMs = 86_400_000;
const zero = {
  cancelled: 0,
  durationMs: 0,
  errors: 0,
  inputBytes: 0,
  outputBytes: 0,
  requests: 0,
  toolCalls: 0,
};
type Counters = typeof zero;

function noise(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43_758.5453;
  return value - Math.floor(value);
}
function add(target: Counters, source: Counters) {
  target.cancelled += source.cancelled;
  target.durationMs += source.durationMs;
  target.errors += source.errors;
  target.inputBytes += source.inputBytes;
  target.outputBytes += source.outputBytes;
  target.requests += source.requests;
  target.toolCalls += source.toolCalls;
}
function slice(total: Counters, share: number, seed: number): Counters {
  const requests = Math.round(total.requests * share);
  return {
    cancelled: Math.round(total.cancelled * share),
    durationMs: Math.round(requests * (260 + 160 * noise(seed))),
    errors: Math.round(total.errors * share * (0.6 + noise(seed + 1))),
    inputBytes: requests * 610,
    outputBytes: requests * Math.round(9200 + 5200 * noise(seed + 2)),
    requests,
    toolCalls: Math.round(requests * 0.92),
  };
}
function dayCounters(index: number): Counters {
  const weekday = new Date(index * dayMs).getUTCDay();
  const weekend = weekday === 0 || weekday === 6 ? 0.45 : 1;
  const requests = Math.round((38 + 34 * noise(index)) * weekend);
  const incident = noise(index + 7) > 0.9 ? 6 : 0;
  return {
    cancelled: Math.round(2 * noise(index + 3)),
    durationMs: Math.round(requests * (300 + 140 * noise(index + 4))),
    errors: Math.round(requests * 0.025 * noise(index + 5)) + incident,
    inputBytes: requests * 610,
    outputBytes: requests * 11_400,
    requests,
    toolCalls: Math.round(requests * 0.92),
  };
}

export function demoAuditReport(days: number, referenceDay: string) {
  const end = Math.floor(Date.parse(`${referenceDay}T00:00:00.000Z`) / dayMs);
  const daily = Array.from({ length: days }, (_, offset) => {
    const index = end - days + 1 + offset;
    return {
      ...dayCounters(index),
      day: new Date(index * dayMs).toISOString().slice(0, 10),
    };
  });
  const totals = { ...zero };
  for (const day of daily) {
    add(totals, day);
  }
  const lastSeen = `${referenceDay}T21:42:00.000Z`;
  const clientRows = clients.map((client, index) => ({
    ...slice(totals, client.share, index + 11),
    clientId: client.clientId,
    lastSeen: index ? `${referenceDay}T18:05:00.000Z` : lastSeen,
  }));
  const recent = Array.from({ length: 24 }, (_, index) => {
    const client = clients[noise(index + 40) < 0.58 ? 0 : 1];
    const pick = noise(index + 60);
    let cumulative = 0;
    const tool =
      toolMix.find((item) => {
        cumulative += item.share;
        return pick < cumulative;
      })?.tool ?? ToolName.status;
    const failed = noise(index + 80) > 0.93;
    const outputBytes = failed ? 180 : Math.round(4000 + 16_000 * noise(index));
    return {
      clientId: client.clientId,
      durationMs: Math.round(120 + 620 * noise(index + 90)),
      id: `demo-request:${index}`,
      inputBytes: 520 + Math.round(240 * noise(index + 2)),
      model: client.model,
      outcome: failed ? ("failed" as const) : ("success" as const),
      outputBytes,
      startedAt: new Date(
        Date.parse(lastSeen) - index * 47 * 60_000,
      ).toISOString(),
      status: failed ? 502 : 200,
      tool,
    };
  });
  return {
    clients: clientRows,
    daily,
    days,
    grantCursor: null,
    grants: clients.map((client) => ({
      clientId: client.clientId,
      clientName: client.clientName,
      createdAt: (end - client.createdDay) * 86_400,
      expiresAt: null,
      id: `demo-grant:${client.clientId}`,
      scope: [...client.scope],
    })),
    models: clients.map((client, index) => ({
      ...slice(totals, client.share, index + 11),
      model: client.model,
    })),
    recent,
    since: daily[0] ? `${daily[0].day}T00:00:00.000Z` : lastSeen,
    totals,
  } satisfies AuditReport;
}
