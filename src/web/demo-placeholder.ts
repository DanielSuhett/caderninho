import { demoPeople, demoReferenceDay } from "../fixtures/finance";
import { type AccountApi, createAccountApi } from "./account/account-api";
import { shiftMonth } from "./account/dashboard-period";
import { referenceDay } from "./account/page-requests";
import { createDemoFetch } from "./demo-api";

// Loading pages render their real components over demo answers, so the
// skeleton has the shape and item counts the page will show. The viewer's
// scope is mapped onto the demo: a person becomes the first demo person, other
// identity filters are dropped and dates keep their distance from today,
// otherwise the demo would answer empty.
const dropped = new Set([
  "accountId",
  "cardBrand",
  "cardId",
  "categoryId",
  "connectionId",
  "cursor",
  "grantCursor",
  "institutionId",
  "text",
]);
const scoped = new Map([
  ["personId", demoPeople.at(0)?.id ?? "demo-person"],
  ["spaceId", "personal"],
]);
const datePattern = /^\d{4}-\d{2}(-\d{2})?$/;

function monthIndex(day: string) {
  return Number(day.slice(0, 4)) * 12 + Number(day.slice(5, 7));
}

function demoDate(value: string, distance: number) {
  const month = shiftMonth(value.slice(0, 7), distance);
  if (value.length === 7) {
    return month;
  }
  const last = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
  ).getUTCDate();
  return `${month}-${String(Math.min(Number(value.slice(8)), last)).padStart(2, "0")}`;
}

function demoText(value: string, distance: number) {
  return datePattern.test(value) ? demoDate(value, distance) : value;
}

function demoScope(value: unknown, distance: number): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => demoScope(item, distance));
  }
  if (typeof value === "string") {
    return demoText(value, distance);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, field]) => {
      if (dropped.has(key)) {
        return [];
      }
      return [[key, scoped.get(key) ?? demoScope(field, distance)]];
    }),
  );
}

export function createPlaceholderApi(origin: string, day: string) {
  const distance = monthIndex(demoReferenceDay) - monthIndex(day);
  const demoFetch = createDemoFetch(origin);
  const scopedFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    url.search = new URLSearchParams(
      [...url.searchParams].flatMap(([key, field]) => {
        if (dropped.has(key)) {
          return [];
        }
        return [[key, scoped.get(key) ?? demoText(field, distance)]];
      }),
    ).toString();
    if (request.method !== "POST") {
      return demoFetch(url, { signal: request.signal });
    }
    const body: unknown = await request.json();
    return demoFetch(url, {
      body: JSON.stringify(demoScope(body, distance)),
      method: "POST",
      signal: request.signal,
    });
  };
  return createAccountApi(origin, scopedFetch);
}

let shared: AccountApi | undefined;
export function placeholderApi() {
  shared ??= createPlaceholderApi(location.origin, referenceDay());
  return shared;
}
