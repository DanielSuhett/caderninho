import assert from "node:assert/strict";
import test, { afterEach, mock } from "node:test";
import { setImmediate } from "node:timers/promises";

import { createImportMonitor } from "../account/import-monitor";

afterEach(() => mock.timers.reset());

test("import monitoring pauses when hidden, resumes on return and stops at a terminal state or disposal", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  let visible = true;
  let reads = 0;
  const monitor = createImportMonitor({
    failed: () => assert.fail("unexpected read failure"),
    read: () => {
      reads += 1;
      monitor.schedule(true);
      return Promise.resolve();
    },
    visible: () => visible,
  });
  monitor.wake();
  await setImmediate();
  assert.equal(reads, 1);
  mock.timers.tick(2000);
  await setImmediate();
  assert.equal(reads, 2);
  visible = false;
  monitor.wake();
  mock.timers.tick(60_000);
  await setImmediate();
  assert.equal(reads, 2);
  visible = true;
  monitor.wake();
  await setImmediate();
  assert.equal(reads, 3);
  monitor.schedule(false);
  mock.timers.tick(60_000);
  await setImmediate();
  assert.equal(reads, 3);
  monitor.dispose();
  monitor.wake();
  mock.timers.tick(60_000);
  await setImmediate();
  assert.equal(reads, 3);
});

test("failed status requests back off and stop after five attempts without declaring an import failed", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  let reads = 0;
  let errors = 0;
  const monitor = createImportMonitor({
    failed: () => {
      errors += 1;
    },
    read: () => {
      reads += 1;
      return Promise.reject(new Error("network unavailable"));
    },
    visible: () => true,
  });
  monitor.schedule(true);
  await [2000, 4000, 8000, 16_000, 30_000].reduce(async (previous, delay) => {
    await previous;
    mock.timers.tick(delay);
    await setImmediate();
  }, Promise.resolve());
  assert.equal(reads, 5);
  assert.equal(errors, 5);
  mock.timers.tick(300_000);
  await setImmediate();
  assert.equal(reads, 5);
  monitor.dispose();
});
