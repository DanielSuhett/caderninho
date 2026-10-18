import { type SpawnOptions, spawn } from "node:child_process";

import { createLogger } from "@/shared/logger";
import { tryCatch } from "@/shared/result";

const logger = createLogger({ name: "test-process" });

// Wrangler owns workerd subprocesses. Give each fixture a process group so a
// failed check or interrupted runner closes the whole synthetic runtime.
export function spawnManaged(args: string[], options: SpawnOptions = {}) {
  const child = spawn(process.execPath, args, {
    ...options,
    detached: process.platform !== "win32",
  });
  const finished = new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command exit ${code ?? signal ?? "unknown"}`));
      }
    });
  });
  // Observe rejection immediately, even while the caller polls readiness.
  const completion = tryCatch(finished);
  let stopping: Promise<void> | undefined;
  async function kill(signal: NodeJS.Signals) {
    const pid = child.pid;
    if (!pid) {
      return;
    }
    const { data: _data, error } = await tryCatch(() => {
      if (process.platform === "win32") {
        child.kill(signal);
      } else {
        process.kill(-pid, signal);
      }
    });
    if (error && !("code" in error && error.code === "ESRCH")) {
      throw error;
    }
  }
  async function shutdown() {
    await kill("SIGTERM");
    const timer = setTimeout(() => {
      void tryCatch(() => kill("SIGKILL")).then(({ data: _data, error }) => {
        if (error) {
          logger.error(
            { reason: error.message },
            "Managed process kill failed",
          );
        }
      });
    }, 3000);
    try {
      const { data, error } = await completion;
      return error ? undefined : data;
    } finally {
      clearTimeout(timer);
      await kill("SIGKILL");
      process.off("SIGTERM", terminate);
      process.off("SIGINT", interrupt);
    }
  }
  function stop() {
    stopping ??= shutdown();
    return stopping;
  }
  function onSignal(code: number) {
    process.exitCode = code;
    void tryCatch(stop).then(({ data: _data, error }) => {
      if (error) {
        logger.error(
          { reason: error.message },
          "Managed process shutdown failed",
        );
      }
    });
  }
  const terminate = () => onSignal(143);
  const interrupt = () => onSignal(130);
  process.once("SIGTERM", terminate);
  process.once("SIGINT", interrupt);
  void completion.then(({ data: _data, error: _error }) => {
    process.off("SIGTERM", terminate);
    process.off("SIGINT", interrupt);
  });
  return {
    child,
    stop,
    async wait() {
      const { data, error } = await completion;
      if (error) {
        throw error;
      }
      return data;
    },
  };
}
