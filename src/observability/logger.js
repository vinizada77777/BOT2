'use strict';

const crypto = require('node:crypto');

const DATABASE_URL_PATTERN = /\b(postgres(?:ql)?:\/\/)[^\s]+/gi;
const DISCORD_TOKEN_PATTERN = /\b(?:mfa\.[\w-]+|[\w-]{20,}\.[\w-]{6,}\.[\w-]{20,})\b/g;

function redact(value) {
  return String(value ?? '')
    .replace(DATABASE_URL_PATTERN, '$1[REDACTED]')
    .replace(DISCORD_TOKEN_PATTERN, '[REDACTED]');
}

function serializeError(error) {
  if (!error) return '';
  return redact(error.stack || error.message || error);
}

function correlationId() {
  return crypto.randomUUID();
}

function createLogger(output = console) {
  return {
    info(message, details) {
      output.log(redact(details ? `${message} ${JSON.stringify(details)}` : message));
    },
    warn(message, details) {
      output.warn(redact(details ? `${message} ${JSON.stringify(details)}` : message));
    },
    error(message, error, details) {
      const suffix = [serializeError(error), details ? redact(JSON.stringify(details)) : '']
        .filter(Boolean)
        .join(' ');
      output.error(redact(suffix ? `${message} ${suffix}` : message));
    }
  };
}

module.exports = { redact, serializeError, correlationId, createLogger };
