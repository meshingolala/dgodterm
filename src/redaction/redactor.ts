/**
 * DgodTerm Redaction Engine
 * Rigorously scrubs credentials, private keys, passwords, bearer tokens,
 * and sensitive connection data before persistence, logging, or export.
 */

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /passphrase/i,
  /token/i,
  /private[_-]?key/i,
  /auth[_-]?key/i,
  /bearer/i,
  /api[_-]?key/i,
  /vault[_-]?pass/i
];

const PRIVATE_KEY_REGEX = /-----BEGIN [A-Z0-9\s_-]+PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9\s_-]+PRIVATE KEY-----/gi;
const BEARER_TOKEN_REGEX = /bearer\s+[a-zA-Z0-9_.-]{16,}/gi;
const GENERIC_SECRET_KV_REGEX = /(password|secret|passphrase|token|api_key|privkey)\s*[:=]\s*["']?([^"'\s\r\n]{4,})["']?/gi;

export function redactString(input: string): string {
  if (!input || typeof input !== 'string') return input;

  let result = input.replace(PRIVATE_KEY_REGEX, '[REDACTED_PRIVATE_KEY]');
  result = result.replace(BEARER_TOKEN_REGEX, 'Bearer [REDACTED_TOKEN]');
  result = result.replace(GENERIC_SECRET_KV_REGEX, (_match, key) => `${key}=[REDACTED]`);

  return result;
}

export function redactObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return redactString(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((p) => p.test(key));
      if (isSensitiveKey) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = redactObject(value);
      }
    }
    return sanitized as T;
  }

  return obj;
}
