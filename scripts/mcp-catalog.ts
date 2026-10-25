import { writeFile } from "node:fs/promises";

import { tools } from "../src/contracts";

const queries = tools.filter((tool) => tool.annotations.readOnlyHint).length;
const sync = tools.filter((tool) => tool.annotations.openWorldHint).length;
const writes = tools.length - queries - sync;
const lines = [
  "# Inventário MCP",
  "",
  "Gerado por `npm run docs:mcp` a partir do registro de ferramentas.",
  "",
  `${tools.length} ferramentas: ${queries} consultas/prévias, ${writes} escritas locais e ${sync} operação de sincronização.`,
  "",
  "| Ferramenta | Operação | Schema de saída | Descrição |",
  "| --- | --- | --- | --- |",
  ...tools.map((tool) => {
    let operation = "escrita local";
    if (tool.annotations.readOnlyHint) {
      operation = "consulta/prévia";
    } else if (tool.annotations.openWorldHint) {
      operation = "sincronização";
    }
    return `| \`${tool.name}\` | ${operation} | ${"outputSchema" in tool ? "sim" : "—"} | ${tool.description.replaceAll("|", "\\|")} |`;
  }),
  "",
];
await writeFile(
  new URL("../docs/mcp-tools.md", import.meta.url),
  lines.join("\n"),
);
