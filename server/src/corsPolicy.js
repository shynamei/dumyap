// Pure, dependency-free origin-decision policy for the local transcription
// backend. Isolated from Express so it is trivially unit-testable and so the
// security decision lives in exactly one place.
//
// The ONLY thing that grants cross-origin access is a strict, normalized match
// against the configured chrome-extension://<id> allow-list. There is no
// wildcard, no reflection of arbitrary origins, and no trust of any
// client-supplied header as proof of origin. A request with no Origin header
// (curl, health check) is allowed; the literal string "null" and every
// arbitrary website origin are denied.

/**
 * Canonicalize an origin for comparison: trim surrounding whitespace and strip
 * any trailing slash(es). Case-sensitive on purpose — browsers send
 * `chrome-extension://<id>` lowercase, and a different-cased id is a different
 * extension, so it must not match.
 *
 * @param {string} origin
 * @returns {string}
 */
function normalize(origin) {
  return origin.trim().replace(/\/+$/, "");
}

/**
 * Decide whether a request's Origin is permitted.
 *
 * @param {string|undefined|null} origin  The request's Origin header, if any.
 * @param {string[]} allowedOrigins        Already-normalized allow-list (from config).
 * @returns {boolean}
 */
export function isOriginAllowed(origin, allowedOrigins) {
  // No Origin header at all (curl, health check, same-origin tooling).
  // The literal string "null" is NOT this case and is handled below.
  if (origin === undefined || origin === null || origin === "") {
    return true;
  }

  return allowedOrigins.includes(normalize(origin));
}
