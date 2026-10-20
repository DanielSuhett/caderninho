import assert from "node:assert/strict";
import test from "node:test";

import type { PluggyConnect } from "pluggy-connect-sdk";

import { required } from "../../../../tests/support";
import { createConnectWidget } from "..";

const accountConnectToken = () => ({
  accessToken: "synthetic",
  configuration: {
    connectorIds: [200],
    includeSandbox: false,
    selectedConnectorId: 200,
  },
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
      destroyed += 1;
      return Promise.resolve();
    }
  }
  const callbacks = {
    ...accountConnectToken(),
    configuration: {
      connectorIds: [321],
      includeSandbox: false,
      selectedConnectorId: 321,
    },
    onClose() {
      throw new Error("stale close");
    },
    onError() {
      throw new Error("stale error");
    },
    onSuccess: () => undefined,
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
      initialized += 1;
      return Promise.resolve();
    }
    destroy() {
      destroyed += 1;
      return destroyed === 1 ? closed : Promise.resolve();
    }
  }
  const widget = createConnectWidget(async () => ({ PluggyConnect: Widget }));
  const options = {
    ...accountConnectToken(),
    onClose: () => undefined,
    onError: () => undefined,
    onSuccess: () => undefined,
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
