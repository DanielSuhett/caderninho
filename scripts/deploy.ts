import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { z } from "zod/v4";

import { tryCatch } from "../src/shared";
import { adminConfigured } from "../src/worker/auth";

const SecretListSchema = z.array(z.object({ name: z.string() }));
const workerAddress = /https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev\b/;
const missingWorkerMessage =
  "If this is a new Worker, run `wrangler deploy` first to create it.";
const execute = promisify(execFile);
type RunWrangler = (args: string[]) => Promise<string>;
const passwordInstructions =
  "Defina ADMIN_PASSWORD no formulário de instalação da Cloudflare ou no ambiente do deploy, com uma senha de 16 a 256 caracteres.";
const InstallationPasswordSchema = z.string().refine(adminConfigured, {
  message: passwordInstructions,
});

export async function prepareAccess({
  run,
  password,
}: {
  run: RunWrangler;
  password?: string;
}) {
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
  if (
    secrets.some((secret) =>
      ["ADMIN_PASSWORD", "ADMIN_ACCESS_HASH"].includes(secret.name),
    )
  ) {
    return null;
  }
  const supplied = InstallationPasswordSchema.safeParse(password);
  if (!supplied.success) {
    throw new Error(passwordInstructions);
  }
  return { ADMIN_PASSWORD: supplied.data };
}

export async function deployInstallation({
  run,
  output,
  password,
}: {
  run: RunWrangler;
  output: (value: string) => void;
  password?: string;
}) {
  const access = await prepareAccess({
    run,
    ...(password !== undefined && { password }),
  });
  output(await run(["d1", "migrations", "apply", "DB", "--remote"]));
  const directory = await mkdtemp(join(tmpdir(), "caderninho-install-"));
  try {
    const args = ["deploy"];
    if (access) {
      const path = join(directory, "access.json");
      await writeFile(path, JSON.stringify(access), {
        mode: 0o600,
      });
      args.push("--secrets-file", path);
    }
    const result = await run(args);
    output(result);
    const address = result.match(workerAddress)?.[0];
    if (address) {
      output(
        `\nAbra seu Caderninho: ${address}/account\nUse a senha ou chave já configurada nesta instalação.\n`,
      );
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
      ...(process.env.ADMIN_PASSWORD !== undefined && {
        password: process.env.ADMIN_PASSWORD,
      }),
    }),
  );
  if (error) {
    process.stderr.write(
      `Não foi possível concluir o deploy. O acesso anterior não foi substituído.\n${passwordInstructions}\n`,
    );
    process.exitCode = 1;
  }
}
