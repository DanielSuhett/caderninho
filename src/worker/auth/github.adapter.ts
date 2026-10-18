import ky from "ky";
import { z } from "zod/v4";

export interface GithubSettings {
  PUBLIC_ORIGIN: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
}

export async function githubIdentity(
  env: GithubSettings,
  code: string,
  verifier: string,
) {
  const tokenResponse = await ky(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        code_verifier: verifier,
        redirect_uri: new URL("/callback", env.PUBLIC_ORIGIN).href,
      }),
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      timeout: false,
      retry: 0,
      throwHttpErrors: false,
    },
  );
  if (!tokenResponse.ok) throw new Error("UPSTREAM_AUTH_UNAVAILABLE");
  const token = z
    .object({ access_token: z.string() })
    .parse(await tokenResponse.json());
  const identity = await ky("https://api.github.com/user", {
    headers: {
      Authorization: "Bearer " + token.access_token,
      Accept: "application/vnd.github+json",
      "User-Agent": "Caderninho",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
    timeout: false,
    retry: 0,
    throwHttpErrors: false,
  });
  if (!identity.ok) throw new Error("UPSTREAM_AUTH_UNAVAILABLE");
  const user = z
    .object({ id: z.number().int().safe().positive() })
    .parse(await identity.json());
  return "github:" + user.id;
}
