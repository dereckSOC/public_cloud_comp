/**
 * Structured JSON logger for server-side use.
 * Outputs one JSON line per log call — compatible with Cloud Logging, Datadog, etc.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function log(level, message, fields = {}) {
  if (LEVELS[level] < MIN_LEVEL) return;
  const entry = {
    severity: level.toUpperCase(),
    message,
    timestamp: new Date().toISOString(),
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === "error") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");
}

const logger = {
  debug: (msg, fields) => log("debug", msg, fields),
  info:  (msg, fields) => log("info",  msg, fields),
  warn:  (msg, fields) => log("warn",  msg, fields),
  error: (msg, fields) => log("error", msg, fields),
  /** Return a child logger with pre-bound fields (e.g. requestId) */
  child: (defaultFields) => ({
    debug: (msg, fields) => log("debug", msg, { ...defaultFields, ...fields }),
    info:  (msg, fields) => log("info",  msg, { ...defaultFields, ...fields }),
    warn:  (msg, fields) => log("warn",  msg, { ...defaultFields, ...fields }),
    error: (msg, fields) => log("error", msg, { ...defaultFields, ...fields }),
  }),
};

export default logger;
