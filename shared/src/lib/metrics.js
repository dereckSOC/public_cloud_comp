/**
 * Simple in-memory Prometheus-style counter store.
 * Not persisted across restarts — suitable for single-process use.
 */

// Map of "name{label1=val1,label2=val2}" -> number
const counters = new Map();

/**
 * Serialize labels object to Prometheus label string, e.g. {method:"GET"} -> 'method="GET"'
 * @param {Record<string, string>} labels
 * @returns {string}
 */
function serializeLabels(labels) {
  const entries = Object.entries(labels);
  if (entries.length === 0) return "";
  return "{" + entries.map(([k, v]) => `${k}="${v}"`).join(",") + "}";
}

/**
 * Build the map key for a counter.
 * @param {string} name
 * @param {Record<string, string>} labels
 * @returns {string}
 */
function makeKey(name, labels) {
  return name + serializeLabels(labels);
}

/**
 * Increment a named counter (optionally with labels).
 * @param {string} name
 * @param {Record<string, string>} labels
 */
export function incrementCounter(name, labels = {}) {
  const key = makeKey(name, labels);
  counters.set(key, (counters.get(key) ?? 0) + 1);
}

/**
 * Return all counters in Prometheus text exposition format.
 * @returns {string}
 */
export function getMetricsText() {
  const lines = [];
  // Group counters by base metric name for TYPE/HELP headers
  const seen = new Set();
  for (const [key, value] of counters) {
    // Extract base name (everything before '{' or the whole string)
    const baseName = key.split("{")[0];
    if (!seen.has(baseName)) {
      lines.push(`# HELP ${baseName} Counter metric`);
      lines.push(`# TYPE ${baseName} counter`);
      seen.add(baseName);
    }
    lines.push(`${key} ${value}`);
  }
  return lines.join("\n") + (lines.length ? "\n" : "");
}
