import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

import { deployInstallation, prepareAccess } from "../deploy";

const password = "synthetic-installation-password";
const passwordInstructionsPattern = /Defina ADMIN_PASSWORD.*16 a 256/;

test("first deployment installs the chosen password privately and returns an ordinary login URL", async () => {
  const messages: string[] = [];
  const calls: string[][] = [];
  let secretFile = "";
  await deployInstallation({
    output: (value) => messages.push(value),
    password,
    run: async (args) => {
      calls.push(args);
      if (args[0] === "secret") {
        return "[]";
      }
      if (args[0] === "d1") {
        return "Migrations complete";
      }
      secretFile = args[2] ?? "";
      assert.deepEqual(JSON.parse(await readFile(secretFile, "utf8")), {
        ADMIN_PASSWORD: password,
      });
      assert.equal((await stat(secretFile)).mode % 0o1000, 0o600);
      assert.equal(messages.join("").includes(password), false);
      return "Deployed https://synthetic.owner.workers.dev";
    },
  });
  const output = messages.join("");
  assert.ok(output.includes("https://synthetic.owner.workers.dev/account"));
  assert.equal(output.includes("#access_key="), false);
  assert.equal(output.includes(password), false);
  assert.equal(JSON.stringify(calls).includes(password), false);
  assert.deepEqual(
    calls.map((args) => args[0]),
    ["secret", "d1", "deploy"],
  );
  await assert.rejects(stat(secretFile));
});

test("passwords supplied by the Cloudflare form and existing keys are preserved even if the build environment has another password", async () => {
  await Promise.all(
    ["ADMIN_ACCESS_HASH", "ADMIN_PASSWORD"].map(async (name) => {
      const messages: string[] = [];
      const calls: string[][] = [];
      await deployInstallation({
        output: (value) => messages.push(value),
        password: "different-synthetic-password",
        run: (args) => {
          calls.push(args);
          return Promise.resolve(
            args[0] === "secret"
              ? JSON.stringify([{ name }])
              : "Deployed https://synthetic.owner.workers.dev",
          );
        },
      });
      assert.deepEqual(calls.at(-1), ["deploy"]);
      assert.equal(messages.join("").includes("synthetic-password"), false);
      assert.ok(messages.join("").includes("/account"));
      assert.equal(
        await prepareAccess({
          run: () => Promise.resolve(JSON.stringify([{ name }])),
        }),
        null,
      );
    }),
  );
});

test("an unconfigured installation never migrates or publishes without a valid chosen password", async () => {
  await Promise.all(
    [undefined, "", "too-short", "x".repeat(257)].map(async (supplied) => {
      const calls: string[][] = [];
      await assert.rejects(
        deployInstallation({
          output: () => assert.fail("No deployment output expected"),
          ...(supplied !== undefined && { password: supplied }),
          run: (args) => {
            calls.push(args);
            return Promise.resolve("[]");
          },
        }),
        passwordInstructionsPattern,
      );
      assert.equal(calls.length, 1);
    }),
  );
});

test("only an explicitly missing Worker starts fresh; permission and malformed responses abort", async () => {
  await Promise.all(
    [
      "Worker not found [code: 10007]",
      'Worker "caderninho" not found.\n\nIf this is a new Worker, run `wrangler deploy` first to create it.',
    ].map(async (message) => {
      assert.deepEqual(
        await prepareAccess({
          password,
          run: () => Promise.reject(new Error(message)),
        }),
        { ADMIN_PASSWORD: password },
      );
    }),
  );
  await Promise.all(
    ["permission denied", "invalid json", "{}", '[{"name":null}]'].map(
      async (response) => {
        const calls: string[][] = [];
        await assert.rejects(
          deployInstallation({
            output: () => assert.fail("No deployment output expected"),
            password,
            run: (args) => {
              calls.push(args);
              return response === "permission denied"
                ? Promise.reject(new Error(response))
                : Promise.resolve(response);
            },
          }),
        );
        assert.equal(calls.length, 1);
      },
    ),
  );
});

test("a failed upload never returns the password and removes its temporary secret file", async () => {
  const messages: string[] = [];
  let secretFile = "";
  await assert.rejects(
    deployInstallation({
      output: (value) => messages.push(value),
      password,
      run: (args) => {
        if (args[0] === "secret") {
          return Promise.resolve("[]");
        }
        if (args[0] === "d1") {
          return Promise.resolve("Migrations complete");
        }
        secretFile = args[2] ?? "";
        return Promise.reject(new Error("Synthetic upload failure"));
      },
    }),
  );
  assert.equal(messages.join("").includes(password), false);
  assert.equal(messages.join("").includes("/account"), false);
  await assert.rejects(stat(secretFile));
});
