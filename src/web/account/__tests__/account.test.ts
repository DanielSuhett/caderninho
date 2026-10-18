import assert from "node:assert/strict";
import test from "node:test";

import type { PluggyConnect } from "pluggy-connect-sdk";

import { accountSnapshot } from "#testing/account.ts";
import {
  AccountRequestError,
  createAccountApi,
} from "#web/account/account-api.ts";
import {
  missionStates,
  preserveEvidence,
  supportPrompt,
} from "#web/account/account-model.ts";
import { createConnectWidget } from "#web/account/connect-widget.ts";

await test("account commands preserve CSRF, validate responses and never retry an uncertain mutation", async () => {
  const requests: Request[] = [];
  const api = createAccountApi("https://caderninho.test", async (input) => {
    const request = new Request(input);
    requests.push(request);
    if (request.method === "GET") return Response.json(accountSnapshot());
    if (request.url.endsWith("/pause")) return Response.json({ ok: true });
    return Response.json(
      { issue: "rate", private: "never exposed" },
      { status: 429 },
    );
  });
  const signal = new AbortController().signal;
  assert.deepEqual(await api.read(signal, "a&b"), accountSnapshot());
  assert.equal(
    new URL(requests[0]?.url ?? "").searchParams.get("cursor"),
    "a&b",
  );
  await api.pauseSync({ csrf: "synthetic-csrf", signal });
  assert.deepEqual(await requests[1]?.json(), {
    csrf: "synthetic-csrf",
    fields: {},
  });
  await assert.rejects(
    api.requestSync({ csrf: "synthetic-csrf", signal }),
    (error) =>
      error instanceof AccountRequestError &&
      error.issue === "rate" &&
      !error.message.includes("never exposed"),
  );
  assert.equal(requests.length, 3);
  const unavailable = createAccountApi("https://caderninho.test", async () => {
    throw new Error("Network unavailable");
  });
  await assert.rejects(
    unavailable.pauseSync({ csrf: "synthetic-csrf", signal }),
  );
});

await test("expired session, redirected login and malformed account response cannot become valid state", async () => {
  for (const status of [401, 403, 302]) {
    const api = createAccountApi(
      "https://caderninho.test",
      async () => new Response("", { status }),
    );
    await assert.rejects(
      api.read(new AbortController().signal),
      (error) =>
        error instanceof AccountRequestError && error.issue === "session",
    );
  }
  const api = createAccountApi("https://caderninho.test", async () =>
    Response.json({ data: {} }),
  );
  await assert.rejects(api.read(new AbortController().signal));
});

await test("temporary authorization failure preserves evidence without inventing coverage or diagnostic identifiers", () => {
  const previous = accountSnapshot();
  const next = accountSnapshot();
  next.data.clients = [];
  next.data.status.clientsAvailable = false;
  next.data.status.authorized = 0;
  next.data.status.received = 0;
  next.data.status.wizard.sync = "error";
  const retained = preserveEvidence(next, previous);
  assert.deepEqual(retained.data.clients, previous.data.clients);
  assert.equal(retained.data.status.clientsAvailable, false);
  assert.equal(retained.data.status.wizard.sync, "error");
  assert.equal(missionStates(retained.data.status)[3], false);
  assert.equal(missionStates(retained.data.status)[4], true);
  assert.ok(
    !supportPrompt(retained.data.status.wizard).includes("synthetic-grant"),
  );
});

await test("widget ignores late SDK loading and stale events after replacement or disposal", async () => {
  type Options = ConstructorParameters<typeof PluggyConnect>[0];
  const events: Options[] = [];
  let destroyed = 0;
  class Widget {
    constructor(options: Options) {
      events.push(options);
    }
    init() {
      return Promise.resolve();
    }
    destroy() {
      destroyed++;
      return Promise.resolve();
    }
  }
  const callbacks = {
    accessToken: "synthetic-token",
    itemId: undefined,
    onSuccess() {},
    onClose() {
      throw new Error("stale close");
    },
    onError() {
      throw new Error("stale error");
    },
  };
  const widget = createConnectWidget(async () => ({ PluggyConnect: Widget }));
  await widget.open(callbacks);
  await widget.open(callbacks);
  assert.equal(destroyed, 1);
  await events[0]?.onError?.({ message: "ignored" });
  await events[0]?.onClose?.();
  assert.deepEqual(events[1]?.connectorIds, [200]);
  await widget.destroy();
  await events[1]?.onClose?.();
  assert.equal(destroyed, 2);

  let release: ((module: { PluggyConnect: typeof Widget }) => void) | undefined;
  let loaded: (() => void) | undefined;
  const loading = new Promise<void>((resolve) => {
    loaded = resolve;
  });
  const late = createConnectWidget(
    () =>
      new Promise((resolve) => {
        release = resolve;
        loaded?.();
      }),
  );
  const opening = late.open(callbacks);
  await loading;
  await late.destroy();
  release?.({ PluggyConnect: Widget });
  await opening;
  assert.equal(events.length, 2);
});

await test("overlapping opens wait for old widget cleanup and only the latest request creates a widget", async () => {
  let release: (() => void) | undefined;
  const closed = new Promise<void>((resolve) => {
    release = resolve;
  });
  let initialized = 0;
  let destroyed = 0;
  class Widget {
    init() {
      initialized++;
      return Promise.resolve();
    }
    destroy() {
      destroyed++;
      return destroyed === 1 ? closed : Promise.resolve();
    }
  }
  const widget = createConnectWidget(async () => ({ PluggyConnect: Widget }));
  const options = {
    accessToken: "synthetic-token",
    itemId: undefined,
    onSuccess() {},
    onClose() {},
    onError() {},
  };
  await widget.open(options);
  const obsolete = widget.open(options);
  const latest = widget.open(options);
  release?.();
  await Promise.all([obsolete, latest]);
  assert.equal(initialized, 2);
  assert.equal(destroyed, 1);
  await widget.destroy();
});
