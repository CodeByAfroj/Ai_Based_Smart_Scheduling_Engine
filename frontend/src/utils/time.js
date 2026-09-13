/**
 * IST (Indian Standard Time) Utilities
 * UTC+5:30 — single source of truth for all datetime handling.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +5:30 in milliseconds

/**
 * Returns the current time as an IST-aware ISO string (e.g. "2026-09-14T10:35:00+05:30")
 */
export function nowIST() {
  const now = new Date();
  const istMs = now.getTime() + IST_OFFSET_MS - now.getTimezoneOffset() * 60000;
  const istDate = new Date(istMs);
  return istDate.toISOString().replace('Z', '+05:30');
}

/**
 * Converts a datetime-local input string (e.g. "2026-09-14T10:35") 
 * into an IST-aware ISO string (e.g. "2026-09-14T10:35:00+05:30")
 * This ensures the backend receives the exact IST time the user typed.
 */
export function localInputToIST(datetimeLocalValue) {
  if (!datetimeLocalValue) return nowIST();
  // datetimeLocalValue is already local time (IST on Indian systems).
  // Just append the IST offset instead of converting to UTC.
  return datetimeLocalValue.length === 16
    ? `${datetimeLocalValue}:00+05:30`
    : `${datetimeLocalValue}+05:30`;
}

/**
 * Returns a default datetime-local value (IST) offset by `offsetMs` from now.
 * Suitable for use as the default value of a <input type="datetime-local" />.
 */
export function defaultLocalValue(offsetMs = 0) {
  const now = new Date(Date.now() + offsetMs);
  // Get IST wall clock time
  const istMs = now.getTime() + IST_OFFSET_MS - now.getTimezoneOffset() * 60000;
  return new Date(istMs).toISOString().slice(0, 16);
}

/**
 * Formats an ISO datetime string (from backend) for display in IST.
 * Returns a short string like "10:35 AM" or "14 Sep, 10:35 AM".
 */
export function formatIST(isoString, opts = {}) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...(opts.date && { day: '2-digit', month: 'short' }),
    ...opts
  });
}

/**
 * Format date portion only (e.g. "14/09/2026") in IST.
 */
export function formatDateIST(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}
