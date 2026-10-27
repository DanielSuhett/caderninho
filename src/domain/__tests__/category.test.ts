import assert from "node:assert/strict";
import test from "node:test";

import {
  categoryCatalog,
  fixedCategories,
  fixedCategoryId,
  pluggyCategory,
} from "..";

const hexColorPattern = /^#[a-f\d]{6}$/i;

test("the classifier catalog has exactly the 33 requested categories and valid group references in every space", () => {
  assert.equal(fixedCategories.length, 33);
  assert.equal(
    new Set(fixedCategories.map((category) => category.name)).size,
    33,
  );
  for (const spaceId of ["personal", "family"]) {
    const { categories, categoryGroups } = categoryCatalog(spaceId);
    const groups = new Set(categoryGroups.map((group) => group.id));
    for (const category of categories) {
      assert.ok(category.system);
      assert.ok(category.groupId && groups.has(category.groupId));
      assert.match(category.color ?? "", hexColorPattern);
      assert.equal(category.spaceId, spaceId);
    }
    assert.equal(
      categories.find((category) => category.name === "Transferências")?.id,
      `${spaceId}:transfer`,
    );
    assert.equal(
      fixedCategoryId(spaceId, "mercado"),
      `${spaceId}:fixed:mercado`,
    );
  }
});

test("deterministic provider rules preserve specific meaning and map broad labels conservatively", () => {
  for (const [source, expected] of [
    ["Groceries", "mercado"],
    ["Gas", "gas"],
    ["Gas stations", "combustivel"],
    ["Online Courses", "cursos"],
    ["Education", "educacao-geral"],
    ["University", "faculdade"],
    ["Dentist", "odontologia"],
    ["Pharmacy", "farmacia"],
    ["Healthcare", "saude-geral"],
    ["Credit card payment", "transferencias"],
    ["Salary/pro-labore", "salario-renda"],
    ["Proceeds interests and dividends", "investimentos"],
    ["Tolls and in-vehicle payment", "estacionamento-pedagio"],
    ["Vehicle maintenance", "manutencao"],
    ["Pet supplies and vet", "petshop"],
    ["  SALÁRIO  ", "salario-renda"],
    ["Food delivery", "restaurantes"],
  ]) {
    assert.equal(pluggyCategory(source ?? null), expected);
  }
  assert.equal(pluggyCategory(null), null);
  assert.equal(pluggyCategory("Provider category added tomorrow"), null);
  for (const label of [
    "Accomodation",
    "Automotive",
    "Bookstore",
    "Clothing",
    "Credit card payment",
    "Dentist",
    "Digital services",
    "Eating out",
    "Education",
    "Electricity",
    "Electronics",
    "Food delivery",
    "Gas stations",
    "Groceries",
    "Healthcare",
    "Interests charged",
    "Investments",
    "Loans and financing",
    "Mobile",
    "Parking",
    "Pet supplies and vet",
    "Pharmacy",
    "Proceeds interests and dividends",
    "Same person transfer",
    "Services",
    "Shopping",
    "TV",
    "Taxi and ride-hailing",
    "Telecommunications",
    "Tolls and in vehicle payment",
    "Transfer - PIX",
    "Transportation",
    "Travel",
    "University",
    "Vehicle maintenance",
  ]) {
    assert.notEqual(
      pluggyCategory(label),
      null,
      `Known provider label: ${label}`,
    );
  }
});
