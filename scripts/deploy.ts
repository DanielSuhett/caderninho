import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { z } from "zod/v4";

import { tryCatch } from "../src/shared";
import { generateAdminAccess } from "../src/worker/auth";

const SecretListSchema = z.array(z.object({ name: z.string() }));
const workerAddress = /https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev\b/;
const missingWorkerMessage =
  "If this is a new Worker, run `wrangler deploy` first to create it.";
const execute = promisify(execFile);
type RunWrangler = (args: string[]) => Promise<string>;

export async function prepareAccess(run: RunWrangler) {
  const { data, error } = await tryCatch(() =>
    run(["secret", "list", "--format", "json"]),
  );
  if (
    error &&
    !(
      error.message.includes("[code: 10007]") ||
      error.message.includes(missingWorkerMessage)
    )
  ) {
    throw new Error("Não foi possível conferir o acesso existente.", {
      cause: error,
    });
  }
  const secrets = error ? [] : SecretListSchema.parse(JSON.parse(data));
  return secrets.some((secret) =>
    ["ADMIN_PASSWORD", "ADMIN_ACCESS_HASH"].includes(secret.name),
  )
    ? null
    : generateAdminAccess();
}

export async function deployInstallation({
  run,
  output,
}: {
  run: RunWrangler;
  output: (value: string) => void;
}) {
  const access = await prepareAccess(run);
  output(await run(["d1", "migrations", "apply", "DB", "--remote"]));
  const directory = await mkdtemp(join(tmpdir(), "caderninho-install-"));
  try {
    const args = ["deploy"];
    if (access) {
      const path = join(directory, "access.json");
      await writeFile(
        path,
        JSON.stringify({ ADMIN_ACCESS_HASH: access.hash }),
        {
          mode: 0o600,
        },
      );
      args.push("--secrets-file", path);
    }
    const result = await run(args);
    output(result);
    const address = result.match(workerAddress)?.[0];
    if (access) {
      output(
        "\nAcesso privado da sua instalação. Guarde no gerenciador de senhas.\n",
      );
      output(
        address
          ? `${address}/account/login#access_key=${access.key}\n`
          : `Chave de acesso: ${access.key}\n`,
      );
    } else if (address) {
      output(`\nAcesso preservado: ${address}/account\n`);
    }
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

async function runWrangler(args: string[]) {
  const result = await execute(
    process.execPath,
    [
      fileURLToPath(
        new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url),
      ),
      ...args,
      ...process.argv.slice(2),
    ],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  return result.stdout;
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const { data: _data, error } = await tryCatch(() =>
    deployInstallation({
      output: (value) => process.stdout.write(value),
      run: runWrangler,
    }),
  );
  if (error) {
    process.stderr.write(
      "Não foi possível concluir o deploy. O acesso anterior não foi substituído.\n",
    );
    process.exitCode = 1;
  }
}
