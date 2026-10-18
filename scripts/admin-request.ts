import ky from "ky";

export const ADMIN_REQUEST_TIMEOUT_MS = 45_000;

export function adminEndpoint(value: string) {
  const endpoint = new URL(value);
  if (endpoint.protocol !== "https:") {
    throw new Error("HTTPS_REQUIRED");
  }
  return endpoint;
}

export function adminRequest(
  target: URL,
  token: string,
  body: object,
  timeoutMs = ADMIN_REQUEST_TIMEOUT_MS,
) {
  return ky(target, {
    method: "POST",
    redirect: "error",
    retry: 0,
    timeout: timeoutMs,
    signal: AbortSignal.timeout(timeoutMs),
    throwHttpErrors: false,
    headers: { Authorization: `Bearer ${token}` },
    json: body,
  });
}
