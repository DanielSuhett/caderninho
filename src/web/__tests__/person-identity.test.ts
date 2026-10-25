import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PersonPhotoSchema } from "../../contracts";
import {
  PersonAvatar,
  PersonDirectory,
  PersonStack,
  personInitials,
} from "../account/person-identity";

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

test("canonical photos reach composed avatars without copying image data into financial rows", () => {
  const person = {
    id: "owner",
    name: "Pessoa exemplo",
    photo: "/demo-people/ana.jpg",
  };
  const html = renderToStaticMarkup(
    createElement(
      PersonDirectory,
      { value: [person] },
      createElement(PersonAvatar, {
        person: { id: person.id, name: person.name },
      }),
    ),
  );
  assert.ok(html.includes('src="/demo-people/ana.jpg"'));
  const removed = renderToStaticMarkup(
    createElement(
      PersonDirectory,
      { value: [person] },
      createElement(PersonAvatar, { person: { ...person, photo: null } }),
    ),
  );
  assert.ok(!removed.includes("<img"));
  assert.ok(removed.includes("PE"));
});

test("photo command validates bounded raster data and rejects remote URLs and mismatched types", () => {
  const photo =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY1sAAAAASUVORK5CYII=";
  assert.equal(PersonPhotoSchema.safeParse(photo).success, true);
  for (const value of [
    "https://example.test/photo.jpg",
    "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    photo.replace("image/png", "image/jpeg"),
    "data:image/png;base64,???",
    `data:image/png;base64,${"A".repeat(24_576)}`,
  ]) {
    assert.equal(PersonPhotoSchema.safeParse(value).success, false);
  }
});
