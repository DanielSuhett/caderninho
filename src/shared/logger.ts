import pino, { type DestinationStream, type LevelWithSilent } from "pino";
import { z } from "zod/v4";

const level = z
  .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
  .catch("warn")
  .parse(process.env.LOG_LEVEL);

// Wrangler selects Pino's browser build, which writes structured objects through
// the platform logger. Only Node gets a bounded asynchronous stdout buffer.
const standardOutput = pino.destination
  ? pino.destination({ sync: false, minLength: 0, maxLength: 65536 })
  : undefined;

export function createLogger(input: {
  name: string;
  level?: LevelWithSilent;
  destination?: DestinationStream;
}) {
  const customOutput = input.destination;
  const options = {
    level: input.level ?? level,
    base: null,
    browser: {
      asObject: true,
      ...(customOutput && {
        write(entry: object) {
          customOutput.write(`${JSON.stringify(entry)}\n`);
        },
      }),
    },
  };
  const destination = input.destination ?? standardOutput;
  const instance = destination ? pino(options, destination) : pino(options);
  return instance.child({ name: input.name });
}

export const logger = createLogger({ name: "caderninho" });
