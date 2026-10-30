# Transcription CORS Fix Bugfix Design

## Overview

Transcription requests from the dumyap extension popup to the local backend (`http://127.0.0.1:8787`) fail with `Error: Origin not allowed by CORS` even when `ALLOWED_ORIGINS` is set correctly. Two things are wrong in `server/src/index.js`: the origin decision uses a brittle exact `ALLOWED_ORIGINS.includes(origin)` match (sensitive to whitespace and trailing slashes), and on rejection it `throw`s a raw `Error`, producing a stack trace instead of a clean response.

The fix is small and security-preserving: normalize allow-list entries in `config.js`, extract the origin decision into a tiny pure module `corsPolicy.js` (`isOriginAllowed`), and have `index.js` use it to either allow via CORS or return a clean `403` — never throwing, never widening access. The only thing that grants access remains a strict `chrome-extension://<id>` allow-list match.

## Glossary

- **Bug_Condition (C)**: A request whose Origin normalizes to a configured allowed origin but is rejected, OR any disallowed request that triggers a raw thrown `Error` / stack trace instead of a clean 403.
- **Property (P)**: Normalized allowed origins are accepted via CORS; disallowed origins get a clean 403 with no stack trace and no secrets.
- **Preservation**: Requests with no Origin (curl/health) still pass; arbitrary websites and `Origin: null` are still denied; `/transcribe`, `/health`, rate limiting, upload validation, error mapping, loopback bind, and server-side-only API key are unchanged.
- **isOriginAllowed(origin, allowedOrigins)**: New pure function in `server/src/corsPolicy.js` that decides whether an origin is permitted.
- **normalize(origin)**: Trim whitespace and strip trailing slash(es); case-sensitive (browsers send `chrome-extension://<id>` lowercase).
- **ALLOWED_ORIGINS**: Allow-list from `config.js`, now normalized at load time; never defaults to `*`.

## Bug Details

### Bug Condition

The bug manifests when a request carries an Origin header. The origin callback in `index.js` either rejects an origin that should match (because the comparison is exact and the configured entry or incoming value differs by whitespace / trailing slash), or it throws a raw `Error` on any disallowed origin, emitting a stack trace instead of returning a clean rejection.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type HttpRequest (has optional origin header)
  OUTPUT: boolean

  RETURN
    // Case A: should be allowed but is rejected
    ( normalize(input.origin) IN normalize(ALLOWED_ORIGINS)
        AND request is rejected by the current origin callback )
    OR
    // Case B: disallowed origin produces a thrown Error / stack trace
    ( input.origin is present
        AND normalize(input.origin) NOT IN normalize(ALLOWED_ORIGINS)
        AND current callback throws Error instead of returning a clean 403 )
END FUNCTION
```

### Examples

- Configured `ALLOWED_ORIGINS=chrome-extension://abc123/`; incoming `Origin: chrome-extension://abc123` → expected allow, actual reject (trailing-slash mismatch).
- Configured `ALLOWED_ORIGINS=" chrome-extension://abc123 "`; incoming `Origin: chrome-extension://abc123` → expected allow, actual reject (whitespace mismatch).
- `Origin: https://evil.example` → expected clean 403, actual raw `Error("Origin not allowed by CORS")` + stack trace.
- `Origin: null` → expected deny, must stay deny (not treated as "no origin").
- No Origin header (curl/health check) → expected allow, stays allow.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Requests with no Origin header (curl, health check) continue to be allowed.
- Arbitrary website origins and the literal string `Origin: null` continue to be denied.
- `/transcribe` and `/health` continue to serve with unchanged rate limiting, multer upload validation, OpenAI call, and error mapping.
- Backend stays bound to `127.0.0.1`; `host_permissions` of `http://127.0.0.1:8787/*` unchanged.
- OpenAI API key stays server-side only and is never exposed.

**Scope:**
All inputs that do NOT involve the origin-decision path are completely unaffected by this fix. This includes:
- Requests with no Origin header.
- Body/upload handling, rate limiting, and OpenAI error responses.
- The loopback bind and all configuration other than `ALLOWED_ORIGINS` normalization.

## Hypothesized Root Cause

Based on the bug description and the code in `server/src/index.js` and `server/src/config.js`, the issues are:

1. **Brittle exact match**: `ALLOWED_ORIGINS.includes(origin)` compares strings exactly. A trailing slash or stray whitespace in either the configured value or the incoming Origin causes a false negative. `config.js` trims entries on split but does not strip trailing slashes, and `index.js` never normalizes the incoming origin.

2. **Raw throw on rejection**: The callback does `callback(new Error("Origin not allowed by CORS"))`, which surfaces as a stack trace rather than a clean, secret-free response.

3. **Decision logic not isolated/tested**: The origin decision is inline and untested, so edge cases (`null`, trailing slash, whitespace, wrong extension id) are easy to get wrong and hard to regression-guard.

## Correctness Properties

Property 1: Bug Condition - Normalized Allow-List Match

_For any_ request whose Origin header normalizes (trim whitespace, strip trailing slash) to a configured allowed `chrome-extension://<id>` origin, the fixed code SHALL allow the request via CORS; and _for any_ request whose Origin is present but not in the normalized allow-list, the fixed code SHALL reject it with a clean 403 response containing no stack trace and no secrets.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - No-Origin, null, and Arbitrary Origins

_For any_ request where the bug condition does NOT hold — no Origin header (curl/health), `Origin: null`, or an arbitrary website origin — the fixed code SHALL produce the same decision as intended: no-Origin is allowed, while `null` and arbitrary origins are denied, with no wildcard, no reflection of arbitrary origins, and no reliance on any client-provided header as proof of origin.

**Validates: Requirements 3.1, 3.2**

## Fix Implementation

### Changes Required

Assuming the root cause analysis is correct, this is the smallest secure fix.

**File**: `server/src/config.js`

- Normalize each `ALLOWED_ORIGINS` entry at load time: trim, then strip trailing slash(es). Keep `.filter(Boolean)` and the "never defaults to `*`" behavior. Do NOT introduce any extension-id header constant — client headers are spoofable and must not be used for auth.

**File**: `server/src/corsPolicy.js` (new, tiny, pure)

- Export `isOriginAllowed(origin, allowedOrigins)`:
  - returns `true` when `origin` is `undefined`/empty (no Origin header: curl/health).
  - returns `true` when `normalize(origin)` is in the (already-normalized) `allowedOrigins`.
  - returns `false` otherwise — including the literal string `"null"` and any arbitrary website origin.
- Include a minimal `normalize()` helper (trim + strip trailing slash; case-sensitive scheme+host, matching the lowercase `chrome-extension://id` browsers send). Keep it self-contained so it is trivially unit-testable.

**File**: `server/src/index.js`

- CORS config uses the policy and never throws:
  ```js
  cors({
    origin(origin, cb) {
      if (isOriginAllowed(origin, ALLOWED_ORIGINS)) return cb(null, true);
      return cb(null, false); // omit CORS headers instead of throwing
    },
    methods: ["POST", "GET"],
  })
  ```
- Add a small middleware BEFORE the routes: when an Origin header is present AND not allowed, respond `403` with `{ error: "Origin not allowed." }` (no stack trace, no secrets). Requests with no Origin (curl/health) pass through.
- Keep everything else unchanged: multer, rate limit, `/transcribe`, `/health`, the OpenAI call, error mapping, and the `127.0.0.1` loopback bind.

**File**: `server/package.json`

- Add a `test` script running `node --test` against `server/test/`.

**File**: `server/test/corsPolicy.test.js` (new)

- Unit/regression tests for `isOriginAllowed` (see Testing Strategy).

**Docs**: `README.md` / `.env.example` (optional, minor)

- Note the `ALLOWED_ORIGINS` format: comma-separated `chrome-extension://<id>`, no trailing slash.

### Security Decisions (explicit)

- We do NOT allow `Origin: null`.
- We do NOT use a wildcard (`*`).
- We do NOT reflect arbitrary origins.
- We do NOT trust any client-provided header as proof of origin.
- The ONLY thing that grants access is a strict normalized `chrome-extension://<id>` allow-list match. Chromium sends `Origin: chrome-extension://<id>` for popup fetches when `host_permissions` includes the target (the manifest already has `http://127.0.0.1:8787/*`), so the normalized allow-list match is what fixes the bug.
- A safe DEV-ONLY diagnostic may be used during implementation to confirm the actual Origin value, but it MUST NOT log secrets and MUST NOT remain as noisy permanent logging.

## Testing Strategy

### Validation Approach

Two phases: first surface counterexamples that demonstrate the bug on the unfixed code, then verify the fix accepts normalized allowed origins and cleanly denies everything else while preserving existing behavior. Automated tests (`node --test`) cover the pure policy; live Chrome + OpenAI testing is a separate manual step.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix, and confirm the root-cause analysis (brittle exact match + raw throw). If refuted, re-hypothesize.

**Test Plan**: Exercise the origin decision with origins that should match after normalization and with disallowed origins. On the UNFIXED code, observe false rejections and the thrown `Error`/stack trace.

**Test Cases**:
1. **Trailing-slash match**: allowed entry `chrome-extension://abc123`, incoming `chrome-extension://abc123/` (will fail on unfixed code).
2. **Whitespace variant**: incoming `  chrome-extension://abc123  ` (will fail on unfixed code).
3. **Disallowed website**: `https://evil.example` → unfixed throws a raw `Error` with stack trace instead of a clean 403 (will demonstrate defect).
4. **`Origin: null`**: confirm it is not mistaken for "no origin" (edge case).

**Expected Counterexamples**:
- Allowed origins rejected due to trailing-slash / whitespace mismatch.
- Disallowed origins produce a stack trace rather than a clean response.
- Possible causes: exact `includes()` comparison, missing normalization, raw `throw`.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed decision produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := decideOrigin_fixed(input)   // isOriginAllowed + clean 403
  ASSERT expectedBehavior(result)       // allowed→CORS allow; disallowed→clean 403, no stack trace
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed decision matches the intended/original decision.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT decideOrigin_fixed(input) = intendedDecision(input)
  // no-Origin → allow; "null" → deny; arbitrary website → deny
END FOR
```

**Testing Approach**: The pure `isOriginAllowed` function is directly table-testable, so regression cases across the input domain (no-origin, `null`, arbitrary website, wrong extension id, normalization variants) give strong, cheap guarantees that behavior is unchanged for non-buggy inputs.

**Test Plan**: Assert the intended decisions for non-bug inputs directly against `isOriginAllowed`.

**Test Cases**:
1. **No-Origin preservation**: `isOriginAllowed(undefined, list)` → `true`.
2. **`null` preservation**: `isOriginAllowed("null", list)` → `false`.
3. **Arbitrary website preservation**: `isOriginAllowed("https://evil.example", list)` → `false`.
4. **Wrong extension id**: `isOriginAllowed("chrome-extension://zzz999", list)` → `false`.

### Unit Tests

- `isOriginAllowed`: allowed origin match; trailing-slash variant; leading/trailing whitespace variant; no-origin (`undefined`/empty) → allow; `"null"` → deny; arbitrary website → deny; wrong extension id → deny.
- Run via `node --test` using the new `server/package.json` `test` script.

### Property-Based Tests

- Not required for this fix; the input domain is small and fully covered by the table-driven unit cases above. (If added later: generate random non-allow-listed origins and assert `isOriginAllowed` returns `false`, and random whitespace/trailing-slash decorations of an allowed origin and assert `true`.)

### Integration Tests

- Extension `npm run build` succeeds.
- `dist` secret-scan: confirm no OpenAI key or secret is bundled into the extension output.
- Live (manual, separate from automated): load the built extension in Chrome, run a transcription against the local backend, confirm the popup fetch succeeds and that a request from a disallowed origin receives a clean 403 with no stack trace. No API key access is performed by tests.
