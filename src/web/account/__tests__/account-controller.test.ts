import assert from "node:assert/strict";
import test from "node:test";

import type { AccountResponse } from "#contracts/portal.types.ts";
import { accountSnapshot } from "#testing/account.ts";
import { required } from "#testing/helpers.ts";
import type {
  AccountApi,
  AccountBrowser,
  ConnectRequest,
  ConnectWidget,
} from "#web/account/account.types.ts";
import { AccountRequestError } from "#web/account/account-api.ts";
import { createAccountController } from "#web/account/account-controller.ts";
import { pollingDelay } from "#web/account/account-model.ts";

function controllerFixture({
  api = {},
  browser = {},
  widget = {},
}: {
  api?: Partial<AccountApi>;
  browser?: Partial<AccountBrowser>;
  widget?: Partial<ConnectWidget>;
} = {}) {
  return createAccountController({
    api: {
      read: async () => accountSnapshot(),
      connectToken: async () => ({ accessToken: "synthetic-token" }),
      async connectItem() {},
      async pauseSync() {},
      async resumeSync() {},
      async requestSync() {},
      async disconnectAssistants() {},
      async logout() {},
      ...api,
    },
    widget: { async open() {}, async destroy() {}, ...widget },
    browser: {
      step: () => undefined,
      selectStep() {},
      visible: () => true,
      captureFocus: () => () => {},
      async copy() {},
      login() {},
      ...browser,
    },
  });
}

await test("account reads deduplicate and ignore responses from a disposed lifetime after restarting", async () => {
  const old = Promise.withResolvers<AccountResponse>();
  const latest = Promise.withResolvers<AccountResponse>();
  const signals: AbortSignal[] = [];
  const controller = controllerFixture({
    api: {
      read(signal) {
        signals.push(signal);
        return signals.length === 1 ? old.promise : latest.promise;
      },
    },
  });
  const stop = controller.start(() => {});
  const first = controller.actions.refresh();
  const repeated = controller.actions.refresh();
  assert.equal(signals.length, 1);
  stop();
  assert.equal(required(signals[0]).aborted, true);
  const dispose = controller.start(() => {});
  const second = controller.actions.refresh();
  const snapshot = { ...accountSnapshot(), csrf: "current-csrf" };
  latest.resolve(snapshot);
  await second;
  assert.deepEqual(controller.getSnapshot().snapshot, snapshot);
  assert.equal(controller.getSnapshot().step, 2);
  const confirmed = controller.getSnapshot();
  old.resolve(accountSnapshot());
  await Promise.all([first, repeated]);
  assert.deepEqual(controller.getSnapshot(), confirmed);
  dispose();
});

await test("account commands serialize, use the confirmed CSRF and retain the snapshot on session failure", async () => {
  const pending = Promise.withResolvers<void>();
  let commands = 0;
  const controller = controllerFixture({
    api: {
      pauseSync(context) {
        assert.equal(context.csrf, "synthetic-csrf");
        commands++;
        return pending.promise;
      },
      async resumeSync() {
        commands++;
      },
    },
  });
  const dispose = controller.start(() => {});
  await controller.actions.refresh();
  const snapshot = controller.getSnapshot().snapshot;
  assert.equal(pollingDelay(controller.getSnapshot()), 5000);
  const paused = controller.actions.pauseSync();
  await controller.actions.resumeSync();
  assert.equal(commands, 1);
  assert.equal(controller.getSnapshot().busy, true);
  pending.reject(new AccountRequestError("session"));
  await paused;
  assert.deepEqual(controller.getSnapshot().snapshot, snapshot);
  assert.equal(controller.getSnapshot().busy, false);
  assert.deepEqual(controller.getSnapshot().load, {
    kind: "failed",
    session: true,
  });
  assert.equal(pollingDelay(controller.getSnapshot()), undefined);
  dispose();
});

await test("connect persists the returned Item before refreshing and ignores old widget callbacks", async () => {
  const events: ConnectRequest[] = [];
  const saved: string[] = [];
  const steps: number[] = [];
  let restored = 0;
  const controller = controllerFixture({
    api: {
      async connectItem(context, itemId) {
        assert.equal(context.csrf, "synthetic-csrf");
        saved.push(itemId);
      },
    },
    widget: {
      async open(options) {
        events.push(options);
      },
    },
    browser: {
      selectStep(step) {
        steps.push(step);
      },
      captureFocus: () => () => {
        restored++;
      },
    },
  });
  const connected = Promise.withResolvers<void>();
  const dispose = controller.start((state) => {
    if (saved.length === 1 && state.step === 1 && !state.busy) {
      connected.resolve();
    }
  });
  await controller.actions.refresh();
  await controller.actions.connectItem();
  const widget = required(events[0]);
  widget.onClose();
  widget.onSuccess("synthetic-item");
  await connected.promise;
  assert.deepEqual(saved, ["synthetic-item"]);
  assert.deepEqual(steps, [1]);
  assert.equal(restored, 1);
  dispose();
  const stop = controller.start(() => {});
  await controller.actions.refresh();
  const confirmed = controller.getSnapshot();
  widget.onSuccess("obsolete-item");
  widget.onError();
  widget.onClose();
  assert.deepEqual(controller.getSnapshot(), confirmed);
  assert.deepEqual(saved, ["synthetic-item"]);
  assert.equal(restored, 1);
  stop();
});

await test("a disposed command cannot unlock a command in the next account lifetime", async () => {
  const old = Promise.withResolvers<void>();
  const latest = Promise.withResolvers<void>();
  let commands = 0;
  const controller = controllerFixture({
    api: {
      pauseSync: () => (++commands === 1 ? old.promise : latest.promise),
      async resumeSync() {
        commands++;
      },
    },
  });
  const dispose = controller.start(() => {});
  await controller.actions.refresh();
  const first = controller.actions.pauseSync();
  dispose();
  const stop = controller.start(() => {});
  await controller.actions.refresh();
  const second = controller.actions.pauseSync();
  old.resolve();
  await first;
  assert.equal(controller.getSnapshot().busy, true);
  await controller.actions.resumeSync();
  assert.equal(commands, 2);
  latest.resolve();
  await second;
  assert.equal(controller.getSnapshot().busy, false);
  stop();
});

await test("disposing pending token, maintenance and logout work prevents later browser effects", async () => {
  for (const command of ["connectItem", "pauseSync", "logout"] as const) {
    const pending = Promise.withResolvers<void>();
    let effects = 0;
    let reads = 0;
    const controller = controllerFixture({
      api: {
        async read() {
          reads++;
          return accountSnapshot();
        },
        async connectToken() {
          await pending.promise;
          return { accessToken: "synthetic-token" };
        },
        pauseSync: () => pending.promise,
        logout: () => pending.promise,
      },
      widget: {
        async open() {
          effects++;
        },
      },
      browser: {
        login() {
          effects++;
        },
      },
    });
    const dispose = controller.start(() => {});
    await controller.actions.refresh();
    const work = controller.actions[command]();
    dispose();
    const stopped = controller.getSnapshot();
    pending.resolve();
    await work;
    assert.deepEqual(controller.getSnapshot(), stopped);
    assert.equal(effects, 0);
    assert.equal(reads, 1);
  }
});
