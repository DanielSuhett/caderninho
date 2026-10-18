# Project lint conventions

The five reusable rules and their helpers were copied from the author's Open Finance CLI
project at commit ebd7396ab3743c509327d1f092df9e4954925cd4, under tools/oxlint/anti-slop.
They retain their original implementation. The stylistic vendor code retains its
MIT license and upstream provenance. require-try-catch is specific to this repository.

The custom rules apply to the financial TypeScript domain and shared utilities.
Unknown inputs remain necessary at JSON/auth/storage boundaries and are parsed
with Zod; we did not copy rules that prohibit those boundaries or force changing
public query-object contracts into positional parameters. Infrastructure keeps
the native Oxlint checks; generated and vendor code are excluded.
