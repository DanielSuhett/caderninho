import { tryCatch } from "../../shared";

// Only an active import owns a timer. Focus/visibility and explicit refresh can
// reconcile an idle installation without a permanent background poll.
export function createImportMonitor({
  read,
  visible,
  failed,
}: {
  read: () => Promise<void>;
  visible: () => boolean;
  failed: () => void;
}) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = false;
  let reading = false;
  let failures = 0;
  let stopped = false;
  const schedule = (value: boolean) => {
    active = value;
    clearTimeout(timer);
    if (!stopped && active && visible() && failures < 5) {
      timer = setTimeout(run, Math.min(2000 * 2 ** failures, 30_000));
    }
  };
  async function poll() {
    if (stopped || reading || !visible()) {
      return;
    }
    reading = true;
    const { data: _data, error } = await tryCatch(read);
    reading = false;
    if (stopped) {
      return;
    }
    if (error) {
      failures += 1;
      failed();
      schedule(active);
    } else {
      failures = 0;
    }
  }
  function run() {
    // Timer/event callers cannot await; teardown is best effort.
    tryCatch(poll).then(
      ({ data: _data, error: _error }) => undefined,
      () => undefined,
    );
  }
  return {
    dispose() {
      stopped = true;
      clearTimeout(timer);
    },
    schedule,
    wake() {
      failures = 0;
      clearTimeout(timer);
      run();
    },
  };
}
