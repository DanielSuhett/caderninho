import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

import { accessKeyHash } from "../../src/worker/auth";
import { deployInstallation, prepareAccess } from "../deploy";

const keyPattern = /cad_[a-f0-9]{64}/;

test("first deployment uploads only the hash, returns the private link after success and removes the temporary file", async () => {
  const messages: string[] = [];
  const calls: string[][] = [];
  let secretFile = "";
  let storedHash = "";
  await deployInstallation({
    output: (value) => messages.push(value),
    run: async (args) => {
      calls.push(args);
      if (args[0] === "secret") {
        return "[]";
      }
      if (args[0] === "d1") {
        return "Migrations complete";
      }
      secretFile = args[2] ?? "";
      const content = await readFile(secretFile, "utf8");
      const data: unknown = JSON.parse(content);
      assert.ok(
        data && typeof data === "object" && "ADMIN_ACCESS_HASH" in data,
      );
      assert.equal(typeof data.ADMIN_ACCESS_HASH, "string");
      storedHash = String(data.ADMIN_ACCESS_HASH);
      assert.equal(content.includes("cad_"), false);
      assert.equal((await stat(secretFile)).mode % 0o1000, 0o600);
      assert.equal(messages.join("").includes("cad_"), false);
      return "Deployed https://synthetic.owner.workers.dev";
    },
  });
  const output = messages.join("");
  const key = output.match(keyPattern)?.[0];
  assert.ok(key);
  assert.equal(storedHash, await accessKeyHash(key));
  assert.ok(output.includes(`/account/login#access_key=${key}`));
  assert.equal(JSON.stringify(calls).includes(key), false);
  await assert.rejects(stat(secretFile));
});

test("redeploys preserve existing generated and legacy credentials", async () => {
  await Promise.all(
    ["ADMIN_ACCESS_HASH", "ADMIN_PASSWORD"].map(async (name) => {
      const messages: string[] = [];
      const calls: string[][] = [];
      await deployInstallation({
        output: (value) => messages.push(value),
        run: (args) => {
          calls.push(args);
          return Promise.resolve(
            args[0] === "secret" ? JSON.stringify([{ name }]) : "Deployed",
          );
        },
      });
      assert.deepEqual(calls.at(-1), ["deploy"]);
      assert.equal(messages.join("").includes("cad_"), false);
    }),
  );
});

test("only an explicit missing Worker starts fresh; permission and malformed responses abort", async () => {
  const access = await prepareAccess(() =>
    Promise.reject(new Error("Worker not found [code: 10007]")),
  );
  assert.ok(access && keyPattern.test(access.key));
  assert.ok(
    await prepareAccess(() =>
      Promise.reject(
        new Error(
          'Worker "caderninho" not found.\n\nIf this is a new Worker, run `wrangler deploy` first to create it.',
        ),
      ),
    ),
  );
  await Promise.all(
    ["permission denied", "invalid json"].map(async (response) => {
      const calls: string[][] = [];
      await assert.rejects(
        deployInstallation({
          output: () => assert.fail("No deployment output expected"),
          run: (args) => {
            calls.push(args);
            return response === "permission denied"
              ? Promise.reject(new Error(response))
              : Promise.resolve(response);
          },
        }),
      );
      assert.equal(calls.length, 1);
    }),
  );
});

test("a failed upload never returns the key and removes its temporary hash file", async () => {
  const messages: string[] = [];
  let secretFile = "";
  await assert.rejects(
    deployInstallation({
      output: (value) => messages.push(value),
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
  assert.equal(messages.join("").includes("cad_"), false);
  await assert.rejects(stat(secretFile));
});
