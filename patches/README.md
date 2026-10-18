# Pluggy SDK transport patch

`pluggy-sdk@0.92.0` retains its pinned `got@11.8.6`. Only `dist/baseApi.js`
and its declarations are patched; API/resource methods remain upstream code.
There is no vendored SDK or replacement HTTP implementation.

The upstream transport hardcodes its JSON/date parser on reads, ignores the
already-declared `baseUrl`, follows redirects, buffers unbounded responses,
logs upstream bodies, and discards HTTP status/headers when rejecting errors.
The patch exposes inherited Got `requestOptions`, `maxResponseBytes` and
`logErrors`, preserves original errors, invalidates the client token on 401,
and rejects redirects and oversized streams before buffering completes.
Logs contain a fixed message only; Caderninho disables them entirely.

In workerd, a Got request deadline can surface as `ReadError/ECONNRESET` because
`IncomingMessage.aborted` precedes the underlying timeout error. The transport
uses Got cancellation at that deadline and preserves `ETIMEDOUT` classification.
The timer is cleared on every outcome; it is scoped to one HTTP attempt.

Caderninho supplies `lossless-json` through `exactJSON`, a 15-second Got request
timeout and zero retries. Reads allow 4,000,000 bytes; Connect Token clients
allow 16,384 bytes, including authentication. Workflow steps retain durable
`Retry-After` recovery. Each authenticated operation owns its SDK client.

[`patch-package`](https://github.com/ds300/patch-package#readme) 8.0.1 runs as
`postinstall` with `--error-on-fail`, locally and in CI's `npm ci`. Keep this
patch in the installation input. Do not skip lifecycle scripts. A changed
upstream version must rebase the patch and pass synthetic workerd integration,
product, runtime and build checks before upgrading the pinned version.
