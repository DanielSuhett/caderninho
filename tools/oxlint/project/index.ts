import { eslintCompatPlugin } from "@oxlint/plugins";
import { noArrayFilterMapRule } from "./rules/no-array-filter-map.ts";
import { noReduceAccumulatorCopyRule } from "./rules/no-reduce-accumulator-copy.ts";
import { noChainedTypeAssertionsRule } from "./rules/no-chained-type-assertions.ts";
import { requireReadableSpacingRule } from "./rules/require-readable-spacing.ts";
import { requireSafetyCommentForTypeAssertionRule } from "./rules/require-safety-comment-for-type-assertion.ts";
import { requireTryCatchRule } from "./rules/require-try-catch.ts";

const plugin = eslintCompatPlugin({
  meta: { name: "project" },
  rules: {
    "no-array-filter-map": noArrayFilterMapRule,
    "no-reduce-accumulator-copy": noReduceAccumulatorCopyRule,
    "no-chained-type-assertions": noChainedTypeAssertionsRule,
    "require-readable-spacing": requireReadableSpacingRule,
    "require-safety-comment-for-type-assertion": requireSafetyCommentForTypeAssertionRule,
    "require-try-catch": requireTryCatchRule,
  },
});
export default plugin;
