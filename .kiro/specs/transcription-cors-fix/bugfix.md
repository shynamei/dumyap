# Bugfix Requirements Document

## Introduction

Transcription requests from the dumyap extension to the local backend (`http://127.0.0.1:8787`, `server/src/index.js`) fail with `Error: Origin not allowed by CORS` even when `ALLOWED_ORIGINS` is correctly set to the extension's `chrome-extension://<id>` origin. The CORS origin callback allows only a missing Origin and throws a raw `Error` otherwise (producing an ugly stack trace), the allow-list match is brittle to whitespace/trailing slashes, and the handling of the Origin header Chromium sends for fetches from the extension popup is not robust. The fix tightens and cleans up the origin-decision logic while keeping strict allow-listing of `chrome-extension://<id>` origins only.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a request arrives with an Origin header that, after trimming whitespace and a trailing slash, matches a configured `ALLOWED_ORIGINS` entry whose stored form differs only by whitespace or a trailing slash THEN the system rejects the request as not allowed by CORS.
1.2 WHEN a request's Origin is not allowed THEN the system throws a raw `Error("Origin not allowed by CORS")` in the origin callback, producing a stack trace rather than a clean 403 response.

### Expected Behavior (Correct)

2.1 WHEN a request arrives with an Origin that normalizes (trim whitespace, strip trailing slash) to a configured allowed `chrome-extension://<id>` origin THEN the system SHALL allow the request via CORS.
2.2 WHEN a request's Origin is not in the normalized allow-list THEN the system SHALL reject it with a clean 403 response containing no stack trace and no secrets.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a request has no Origin header (e.g. curl, health check) THEN the system SHALL CONTINUE TO allow the request.
3.2 WHEN a request originates from an arbitrary website origin or `Origin: null` THEN the system SHALL CONTINUE TO deny access, and SHALL NOT use a wildcard, reflect arbitrary origins, or treat any client-provided header as proof of origin.
3.3 WHEN a valid allowed request reaches `/transcribe`, `/health`, or any other endpoint THEN the system SHALL CONTINUE TO serve transcription, rate limiting, upload validation, and error handling exactly as before, with the backend bound to `127.0.0.1` and `host_permissions` of `http://127.0.0.1:8787/*` unchanged.
3.4 WHEN the server processes any request THEN the system SHALL CONTINUE TO keep the OpenAI API key server-side only and never expose it.
