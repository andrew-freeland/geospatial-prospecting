export interface LogMeta {
  requestId?: string;
  userId?: string;
  [k: string]: unknown;
}

export function logInfo(message: string, meta: LogMeta = {}): void {
  // Redact PII/secrets before logging in real implementation
  console.log(JSON.stringify({ level: "info", message, ...meta }));
}

export function logError(message: string, meta: LogMeta = {}): void {
  console.error(JSON.stringify({ level: "error", message, ...meta }));
}

