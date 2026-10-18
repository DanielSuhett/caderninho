import pino, { type DestinationStream, type LevelWithSilent } from "pino";
import { z } from "zod/v4";

const level = z
  .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
  .catch("warn")
  .parse(process.env.LOG_LEVEL);

// Wrangler selects Pino's browser build, which writes structured objects through
// the platform logger. Only Node gets a bounded asynchronous stdout buffer.
const standardOutput = pino.destination
  ? pino.destination({ maxLength: 65_536, minLength: 0, sync: false })
  : undefined;

export function createLogger(input: {
  name: string;
  level?: LevelWithSilent;
  destination?: DestinationStream;
}) {
  const { destination: customOutput } = input;
  const options = {
    base: null,
    browser: {
      asObject: true,
      ...(customOutput && {
        write(entry: object) {
          customOutput.write(`${JSON.stringify(entry)}\n`);
        },
      }),
    },
    level: input.level ?? level,
  };
  const destination = input.destination ?? standardOutput;
  const instance = destination ? pino(options, destination) : pino(options);
  return instance.child({ name: input.name });
}

export const logger = createLogger({ name: "caderninho" });
