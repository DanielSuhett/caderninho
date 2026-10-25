import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PersonStack, personInitials } from "../account/person-identity";

test("person stack reflects the selected owner and bounds overflow", () => {
  const people = Array.from({ length: 6 }, (_, index) => ({
    id: String(index),
    name: `Ana Silva ${index}`,
  }));
  const html = renderToStaticMarkup(createElement(PersonStack, { people }));
  assert.ok(html.includes("+3"));
  assert.equal((html.match(/class="person-avatar"/g) ?? []).length, 3);
  const selected = renderToStaticMarkup(
    createElement(PersonStack, { people, personId: "2" }),
  );
  assert.equal((selected.match(/class="person-avatar"/g) ?? []).length, 1);
  assert.equal(personInitials("Ana Silva"), "AS");
  assert.equal(personInitials("Laís"), "L");
});
