import assert from "node:assert/strict";
import test from "node:test";

import type { PluggyConnect } from "pluggy-connect-sdk";

import { accountConnectToken, accountSnapshot } from "@/testing/account";
import { required } from "@/testing/helpers";

import { AccountRequestError, createAccountApi } from "../account-api";
import { createConnectWidget } from "../connect-widget";

await test("account commands preserve CSRF, validate responses and never retry an uncertain mutation", async () => {
  const requests: Request[] = [];
  const api = createAccountApi("https://caderninho.test", async (input) => {
    const request = new Request(input);
    requests.push(request);
    if (request.method === "GET") {
      return Response.json(accountSnapshot());
    }
    if (request.url.endsWith("/pause")) {
      return Response.json({ ok: true });
    }
    return Response.json(
      { issue: "rate", private: "never exposed" },
      { status: 429 },
    );
  });
  const signal = new AbortController().signal;
  assert.deepEqual(await api.read(signal), accountSnapshot());
  await api.pauseSync({ csrf: "synthetic-csrf", signal });
  assert.deepEqual(await requests[1]?.json(), {
    csrf: "synthetic-csrf",
  });
  await assert.rejects(
    api.requestSync({ csrf: "synthetic-csrf", signal }),
    (error) =>
      error instanceof AccountRequestError &&
      error.issue === "rate" &&
      !error.message.includes("never exposed"),
  );
  assert.equal(requests.length, 3);
  let applied = 0;
  const unavailable = createAccountApi("https://caderninho.test", async () => {
    applied++;
    throw new Error("Response lost after the command was applied");
  });
  await assert.rejects(
    unavailable.pauseSync({ csrf: "synthetic-csrf", signal }),
  );
  assert.equal(applied, 1);
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
  for (const body of [JSON.stringify({ data: {} }), "invalid JSON", ""]) {
    const api = createAccountApi(
      "https://caderninho.test",
      async () => new Response(body),
    );
    await assert.rejects(api.read(new AbortController().signal));
  }
  for (const body of [
    "invalid JSON",
    JSON.stringify({ issue: "private-code" }),
  ]) {
    const api = createAccountApi(
      "https://caderninho.test",
      async () => new Response(body, { status: 500 }),
    );
    await assert.rejects(
      api.read(new AbortController().signal),
      (error) =>
        error instanceof AccountRequestError && error.issue === "unknown",
    );
  }
});

await test("account token and Item commands consume one response and preserve command fields", async () => {
  const requests: Request[] = [];
  const api = createAccountApi("https://caderninho.test", async (input) => {
    const request = new Request(input);
    requests.push(request);
    assert.equal(request.headers.get("Accept"), "application/json");
    assert.equal(request.redirect, "manual");
    return request.url.endsWith("connect-token")
      ? Response.json(accountConnectToken())
      : Response.json({ ok: true });
  });
  const context = {
    csrf: "synthetic-csrf",
    signal: new AbortController().signal,
  };
  assert.deepEqual(await api.connectToken(context), accountConnectToken());
  await api.connectToken(context, "synthetic-item");
  await api.connectItem(context, "synthetic-item");
  assert.equal(requests.length, 3);
  assert.deepEqual(await required(requests[0]).json(), { csrf: context.csrf });
  for (const request of requests.slice(1)) {
    assert.deepEqual(await request.json(), {
      csrf: context.csrf,
      itemId: "synthetic-item",
    });
  }
});

await test("account cancellation interrupts a stalled response body without retry", async () => {
  const controller = new AbortController();
  let bodyRead: (() => void) | undefined;
  const reading = new Promise<void>((resolve) => {
    bodyRead = resolve;
  });
  let calls = 0;
  let cancelled = false;
  const api = createAccountApi("https://caderninho.test", async (input) => {
    calls++;
    const { signal } = new Request(input);
    return new Response(
      new ReadableStream({
        start(stream) {
          stream.enqueue(new TextEncoder().encode("{"));
          signal.addEventListener(
            "abort",
            () => {
              cancelled = true;
              stream.error(signal.reason);
            },
            { once: true },
          );
        },
        pull() {
          bodyRead?.();
        },
      }),
    );
  });
  const reason = new Error("View disposed");
  const pending = assert.rejects(
    api.read(controller.signal),
    (error) => error === reason,
  );
  await reading;
  controller.abort(reason);
  await pending;
  assert.equal(calls, 1);
  assert.equal(cancelled, true);
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
    ...accountConnectToken(),
    configuration: {
      connectorIds: [321],
      selectedConnectorId: 321,
      includeSandbox: false,
    },
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
  assert.deepEqual(required(events[1]).connectorIds, [321]);
  assert.equal(required(events[1]).selectedConnectorId, 321);
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
    ...accountConnectToken(),
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
