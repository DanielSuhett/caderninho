import { LOGO_PROXY_PATH, PLUGGY_LOGO_ORIGIN } from "../../../domain";
import { tryCatch } from "../../../shared";

const logoFile = /^[\w-]+\.(?:svg|png|jpe?g|webp)$/;
const LOGO_CACHE = "public, max-age=2592000, stale-while-revalidate=604800";

// Connector icons are public and rarely change, so they are cached for 30
// days at the edge and in the browser despite Pluggy's max-age=0.
export async function fetchInstitutionLogo(
  request: Request,
  ctx: ExecutionContext,
) {
  const file = new URL(request.url).pathname.slice(LOGO_PROXY_PATH.length);
  if (request.method !== "GET" || !logoFile.test(file)) {
    return new Response(null, { status: 404 });
  }
  const key = new Request(`${PLUGGY_LOGO_ORIGIN}${file}`);
  const cache = await caches.open("institution-logos");
  const cached = await cache.match(key);
  if (cached) {
    // Copy so later middleware can still append headers.
    return new Response(cached.body, cached);
  }
  const { data: upstream, error } = await tryCatch(() => fetch(key));
  if (error || !upstream.ok) {
    return new Response(null, {
      headers: { "Cache-Control": "no-store" },
      status: 404,
    });
  }
  const response = new Response(upstream.body, {
    headers: {
      "Cache-Control": LOGO_CACHE,
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'",
      "Content-Type": upstream.headers.get("Content-Type") ?? "image/svg+xml",
      "X-Content-Type-Options": "nosniff",
    },
  });
  // Best effort: a failed cache write only costs a later upstream fetch.
  ctx.waitUntil(tryCatch(() => cache.put(key, response.clone())));
  return response;
}
