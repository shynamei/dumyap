// Regression tests for the CORS origin decision (server/src/corsPolicy.js).
//
// Task 1 (bug condition): on UNFIXED code these fail because corsPolicy.js does
// not exist yet and the inline decision in index.js is a brittle exact match
// plus a raw throw. Once the pure isOriginAllowed() exists and normalizes the
// origin, they pass.
//
// Task 2 (preservation): the intended, unchanged decisions for non-bug inputs
// (no-Origin allowed; "null", arbitrary website, wrong extension id denied).
//
// The allow-list below is the ALREADY-NORMALIZED form config.js produces
// (trimmed, no trailing slash), so the policy's own normalize() only has to
// cope with variation on the incoming origin.

import { test } from "node:test";
import assert from "node:assert/strict";

import { isOriginAllowed } from "../src/corsPolicy.js";

const ALLOWED = ["chrome-extension://abc123"];

// ---------------------------------------------------------------------------
// Task 1 — Bug Condition: normalized allow-list match / clean deny
// ---------------------------------------------------------------------------

test("bug condition: trailing-slash variant of an allowed origin is allowed", () => {
  // Unfixed code rejects this (exact includes() miss on the trailing slash).
  assert.equal(isOriginAllowed("chrome-extension://abc123/", ALLOWED), true);
});

test("bug condition: whitespace-padded allowed origin is allowed", () => {
  // Unfixed code rejects this (exact includes() miss on surrounding spaces).
  assert.equal(isOriginAllowed("  chrome-extension://abc123  ", ALLOWED), true);
});

test("bug condition: arbitrary website origin is denied cleanly (no throw)", () => {
  // Unfixed code throws a raw Error here; the fixed decision must simply
  // return false so index.js can respond with a clean 403.
  assert.doesNotThrow(() => {
    assert.equal(isOriginAllowed("https://evil.example", ALLOWED), false);
  });
});

// ---------------------------------------------------------------------------
// Task 2 — Preservation: no-Origin, "null", arbitrary, wrong extension id
// ---------------------------------------------------------------------------

test("preservation: no Origin header (undefined) is allowed (curl/health)", () => {
  assert.equal(isOriginAllowed(undefined, ALLOWED), true);
});

test("preservation: empty Origin is allowed (treated as no Origin)", () => {
  assert.equal(isOriginAllowed("", ALLOWED), true);
});

test('preservation: literal "null" origin is denied (not "no origin")', () => {
  assert.equal(isOriginAllowed("null", ALLOWED), false);
});

test("preservation: arbitrary website origin is denied", () => {
  assert.equal(isOriginAllowed("https://evil.example", ALLOWED), false);
});

test("preservation: wrong extension id is denied", () => {
  assert.equal(isOriginAllowed("chrome-extension://zzz999", ALLOWED), false);
});

// ---------------------------------------------------------------------------
// Extra table-driven coverage of the normalized match surface.
// ---------------------------------------------------------------------------

const cases = [
  { origin: "chrome-extension://abc123", expected: true, note: "exact match" },
  {
    origin: "chrome-extension://abc123/",
    expected: true,
    note: "single trailing slash",
  },
  {
    origin: "chrome-extension://abc123//",
    expected: true,
    note: "multiple trailing slashes",
  },
  {
    origin: "chrome-extension://ABC123",
    expected: false,
    note: "case-sensitive: different id casing is a different origin",
  },
  {
    origin: "chrome-extension://abc1234",
    expected: false,
    note: "superstring id must not match",
  },
];

for (const { origin, expected, note } of cases) {
  test(`table: ${JSON.stringify(origin)} -> ${expected} (${note})`, () => {
    assert.equal(isOriginAllowed(origin, ALLOWED), expected);
  });
}
