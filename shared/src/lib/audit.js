import logger from "./logger.js";

/**
 * Emit a structured audit log entry for CREATE, UPDATE, or DELETE operations.
 * @param {string} action - e.g. "CREATE_EVENT", "UPDATE_QUESTION", "DELETE_BOOTH"
 * @param {Record<string, unknown>} fields - e.g. { userId, eventId, boothId }
 */
export function auditLog(action, fields = {}) {
  logger.info("AUDIT: " + action, { audit: true, ...fields });
}
