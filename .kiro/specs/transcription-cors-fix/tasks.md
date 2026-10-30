# Implementation Plan

## Overview

A minimal, security-preserving CORS fix: normalize `ALLOWED_ORIGINS`, add a pure `isOriginAllowed` policy, and wire it into the server so disallowed origins get a clean 403 instead of a thrown error, all backed by regression tests. The allow-list stays strict `chrome-extension://<id>` only — no wildcard, no `null`, no origin reflection, and no trust of client-supplied headers.

## Task Dependency Graph

```
1. Bug condition exploration test ─┐
                                   ├─> 3.1 ─> 3.2 ─> 3.3 ─> 3.4 ─> 3.5 (re-run task 1) ─┐
2. Preservation property tests ────┘                                 3.6 (re-run task 2) ─┤
                                                                                           ├─> 5. Checkpoint
                                                                   4. Docs (optional) ─────┘
```

- Tasks **1** and **2** (pre-fix tests) come first and are independent of each other.
- Implementation runs strictly in order: **3.1 → 3.2 → 3.3 → 3.4**.
- **3.5** re-runs the task 1 test; **3.6** re-runs the task 2 tests (both after the fix).
- **4** (documentation) is optional and can happen any time after the fix.
- **5** (checkpoint: `node --test` + extension `npm run build` + `dist/` secret-scan) runs last.

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "2"], "dependsOn": [] },
    { "wave": 2, "tasks": ["3.1"], "dependsOn": ["1", "2"] },
    { "wave": 3, "tasks": ["3.2"], "dependsOn": ["3.1"] },
    { "wave": 4, "tasks": ["3.3"], "dependsOn": ["3.2"] },
    { "wave": 5, "tasks": ["3.4"], "dependsOn": ["3.3"] },
    { "wave": 6, "tasks": ["3.5", "3.6"], "dependsOn": ["3.4"] },
    { "wave": 7, "tasks": ["4", "5"], "dependsOn": ["3.5", "3.6"] }
  ]
}
```

## Tasks

- [ ] 1. Write bug condition exploration test for origin decision
  - **Property 1: Bug Condition** - Normalized Allow-List Match
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the brittle exact-match + raw-throw defect
  - **Scoped Approach**: The input domain is small and deterministic; scope the test to concrete failing cases (table-driven) for reproducibility
  - Create `server/test/corsPolicy.test.js` and assert, against a would-be `isOriginAllowed(origin, allowedOrigins)` with allow-list `["chrome-extension://abc123"]`:
    - trailing-slash variant `chrome-extension://abc123/` → expected allow
    - whitespace variant `  chrome-extension://abc123  ` → expected allow
    - arbitrary website `https://evil.example` → expected clean deny (no thrown Error / stack trace)
  - Run on UNFIXED code via `node --test` in `server/`
  - **EXPECTED OUTCOME**: Test FAILS (module `corsPolicy.js` does not yet exist / decision is brittle) - this proves the bug exists
  - Document counterexamples found (trailing-slash and whitespace rejected; disallowed origin surfaces a raw `Error` in `index.js`)
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - No-Origin, null, and Arbitrary Origins
  - **IMPORTANT**: Follow observation-first methodology - record intended decisions for non-bug inputs
  - Add table-driven cases to `server/test/corsPolicy.test.js` asserting `isOriginAllowed` against allow-list `["chrome-extension://abc123"]`:
    - no Origin (`undefined`/empty) → allow (curl/health)
    - `"null"` → deny (not treated as "no origin")
    - arbitrary website `https://evil.example` → deny
    - wrong extension id `chrome-extension://zzz999` → deny
  - These encode the unchanged intended behavior; no wildcard, no reflection, no client-header trust
  - Run via `node --test` in `server/`
  - **EXPECTED OUTCOME**: These assertions define the baseline to preserve (they pass once the pure module exists, and must keep passing after the fix)
  - _Requirements: 3.1, 3.2_

- [ ] 3. Fix brittle/raw CORS origin decision

  - [ ] 3.1 Normalize allow-list entries in config
    - In `server/src/config.js`, normalize each `ALLOWED_ORIGINS` entry: trim whitespace, then strip trailing slash(es)
    - Keep `.filter(Boolean)` and the "never defaults to `*`" behavior
    - Do NOT add any extension-id header constant (client headers are spoofable)
    - _Bug_Condition: isBugCondition(input) Case A - normalized match rejected by brittle exact comparison_
    - _Expected_Behavior: normalized allowed origins are accepted_
    - _Preservation: allow-list still strict; no wildcard default_
    - _Requirements: 2.1_

  - [ ] 3.2 Create pure origin-policy module
    - Create `server/src/corsPolicy.js` exporting `isOriginAllowed(origin, allowedOrigins)` plus an internal `normalize()` (trim + strip trailing slash(es); case-sensitive)
    - Return `true` when `origin` is `undefined`/empty (no Origin header)
    - Return `true` when `normalize(origin)` is in the already-normalized `allowedOrigins`
    - Return `false` otherwise, including the literal string `"null"` and arbitrary origins
    - Keep it self-contained and dependency-free for unit testing
    - _Bug_Condition: isBugCondition(input) Case A and B_
    - _Expected_Behavior: expectedBehavior(result) - allow normalized match; deny everything else cleanly_
    - _Preservation: no-Origin→allow; "null"/arbitrary→deny_
    - _Requirements: 2.1, 2.2, 3.1, 3.2_

  - [ ] 3.3 Wire the policy into the server without throwing
    - In `server/src/index.js`, use `isOriginAllowed` in `cors({ origin })`: allowed → `cb(null, true)`, otherwise → `cb(null, false)` (never throw)
    - Add a pre-route middleware: when an Origin header is present AND disallowed, respond `403` with `{ error: "Origin not allowed." }` (no stack trace, no secrets); requests with no Origin pass through
    - Leave multer, rate limiting, `/transcribe`, `/health`, the OpenAI call, error mapping, and the `127.0.0.1` loopback bind unchanged
    - _Bug_Condition: isBugCondition(input) Case B - raw throw replaced by clean 403_
    - _Expected_Behavior: expectedBehavior(result) - clean 403 for disallowed, CORS allow for allowed_
    - _Preservation: /transcribe, /health, rate limit, upload validation, error mapping, loopback bind, server-side-only API key unchanged_
    - _Requirements: 2.2, 3.3, 3.4_

  - [ ] 3.4 Add test script to server package.json
    - In `server/package.json`, add a `test` script running `node --test` against `server/test/`
    - _Expected_Behavior: automated regression tests are runnable_
    - _Requirements: 2.1, 2.2, 3.1, 3.2_

  - [ ] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Normalized Allow-List Match
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - Run `node --test` in `server/`
    - **EXPECTED OUTCOME**: Test PASSES (confirms trailing-slash/whitespace variants allowed and disallowed origin denied cleanly)
    - _Requirements: 2.1, 2.2_

  - [ ] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - No-Origin, null, and Arbitrary Origins
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (no-Origin allowed; `"null"`, arbitrary website, wrong extension id denied) - no regressions
    - _Requirements: 3.1, 3.2_

- [ ] 4. Document ALLOWED_ORIGINS format (optional, minor)
  - Add a short note in `README.md` and/or `server/.env.example`: `ALLOWED_ORIGINS` is comma-separated `chrome-extension://<id>` values, no trailing slash
  - _Requirements: 2.1_

- [ ] 5. Checkpoint - Validate without touching secrets
  - Run `node --test` in `server/` - all CORS policy tests pass
  - Run extension `npm run build` at the repo root - build succeeds
  - Secret-scan `dist/` to confirm no OpenAI API key or secret is bundled
  - **DO NOT** read, print, or expose the OpenAI API key; make no commits or pushes
  - **NOTE**: Live Chrome + OpenAI transcription testing is manual and performed separately
  - Ensure all tests pass; ask the user if questions arise
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_

## Notes

- Do not access, read, print, or expose the OpenAI API key at any point.
- Make no commits and no pushes.
- Stay on branch `feat/multilingual-transcription`.
- Live Chrome + OpenAI transcription testing is manual and performed separately from the automated `node --test` and build checks.
