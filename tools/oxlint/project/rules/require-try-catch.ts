import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";

function containsAwait(node: ESTree.Node): boolean {
  const nestedFunctions = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);
  const stack: ESTree.Node[] = [node];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    if (current.type === "AwaitExpression") return true;
    if (nestedFunctions.has(current.type)) continue;
    for (const [key, value] of Object.entries(current)) {
      if (key === "parent") continue;
      if (!value || typeof value !== "object") continue;
      const children = Array.isArray(value) ? value : [value];
      for (const child of children) {
        if (child && typeof child === "object" && "type" in child) stack.push(child);
      }
    }
  }
  return false;
}

export const requireTryCatchRule = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Use the discriminated tryCatch Result for asynchronous error recovery." },
    messages: { asyncCatch: "Handle this asynchronous failure with tryCatch and an early return; keep synchronous parsing catches local." },
  },
  createOnce(context) {
    return {
      TryStatement(node) {
        if (node.handler && containsAwait(node.block)) context.report({ node: node.handler, messageId: "asyncCatch" });
      },
    };
  },
});
